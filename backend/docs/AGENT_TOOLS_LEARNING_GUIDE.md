# Agent Tools Source Code Learning Guide

This guide explains `backend/app/agents/tools.py` and the rest of the source tree around it.
Read it when you want to understand how the assistant calls tools, retrieves document metadata,
queries demo business data, and creates tickets.

---

## Project Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app factory and CORS setup
│   ├── agents/
│   │   ├── graph.py             # LangGraph pipeline: AgentRunner + all node methods
│   │   ├── state.py             # AgentState TypedDict that travels through every node
│   │   └── tools.py             # Three async tool functions called by _tool_caller
│   ├── api/
│   │   ├── deps.py              # Dependency injection: JWT auth + services wired with lru_cache
│   │   └── routes/
│   │       ├── auth.py          # POST /v1/auth/register, /login; GET /v1/auth/me
│   │       ├── chat.py          # POST /v1/chat and POST /v1/chat/stream (SSE)
│   │       ├── conversations.py # CRUD for user-owned conversations + messages
│   │       ├── documents.py     # POST /v1/documents/upload
│   │       ├── tickets.py       # GET /v1/tickets and GET /v1/tickets/{id} (SessionDep)
│   │       └── health.py        # GET /health
│   ├── core/
│   │   ├── config.py            # Settings (pydantic-settings, reads .env)
│   │   └── security.py          # bcrypt password hashing + JWT create/decode
│   ├── db/
│   │   ├── database.py          # SQLModel async engine, get_session dependency, SessionDep
│   │   ├── models.py            # SQLModel: User, Conversation, Message, Ticket
│   │   ├── users.py             # User repo helpers
│   │   ├── conversations.py     # Conversation + message repo helpers
│   │   ├── fake_database.py     # In-memory fake business metrics
│   │   └── tickets.py           # Ticket repo helpers + TicketStore (SQLModel ORM)
│   ├── schemas/
│   │   ├── auth.py              # RegisterRequest, LoginRequest, TokenResponse, UserPublic
│   │   ├── chat.py              # ChatRequest, ChatResponse, Citation, ToolResult
│   │   ├── conversation.py      # ConversationSummary, ConversationDetail, MessagePublic
│   │   └── documents.py         # DocumentUploadResponse
│   ├── services/
│   │   ├── chunking.py          # Text → TextChunk list with overlap
│   │   ├── document_loader.py   # PDF/DOCX/TXT/MD → LoadedDocument
│   │   ├── embeddings.py        # EmbeddingClient: openai / local / hash
│   │   ├── rag.py               # RAGService: retrieve + answer (OpenAI or mock)
│   │   └── vector_store.py      # VectorStore: ChromaDB upsert + search
│   └── telemetry/
│       └── tracing.py           # write_trace: appends JSONL to logs/traces.jsonl
├── scripts/
│   ├── seed_sample_docs.py      # Indexes docs/ into ChromaDB
│   └── run_eval.py              # Runs questions from evals/questions.jsonl
├── docs/                        # Learning guides and design docs
├── evals/                       # Eval question sets
├── tests/                       # pytest test suite
├── pyproject.toml               # Dependencies and tooling config
└── .env / .env.example          # Runtime configuration
```

---

## How The App Starts

Entry point: `app/main.py` creates a FastAPI instance via `create_app()`.

```
create_app()
├── reads Settings via get_settings()
├── registers the lifespan handler (calls create_db_and_tables() on startup)
├── adds CORS middleware (cors_origins from .env)
└── mounts six routers:
    ├── health.router          (no prefix)
    ├── auth.router            (prefix: /v1)
    ├── conversations.router   (prefix: /v1)
    ├── chat.router            (prefix: /v1)
    ├── documents.router       (prefix: /v1)
    └── tickets.router         (prefix: /v1)
```

On startup the lifespan handler runs `create_db_and_tables()`, which issues
`SQLModel.metadata.create_all` against Postgres (creates `users`, `conversations`, `messages`,
and `tickets` tables if they do not exist).
Note this is a demo bootstrap, not a migration tool — it never alters an existing table.

Protected routes (chat, conversations, documents, tickets) require a JWT in the
`Authorization: Bearer <access_token>` header. The token is obtained from
`POST /v1/auth/register` or `POST /v1/auth/login`. `api/deps.py :: get_current_user` decodes the
JWT, loads the user from Postgres, and rejects missing or invalid tokens with `401`.

Services are constructed once per process using `lru_cache` in `api/deps.py`:

```
get_settings()          → Settings (reads .env)
get_embedding_client()  → EmbeddingClient(settings)
get_vector_store()      → VectorStore(settings, embedding_client)
get_rag_service()       → RAGService(settings, vector_store)
get_ticket_store()      → TicketStore()           # opens SQLModel sessions from the shared engine
get_agent_runner()      → AgentRunner(settings, rag_service, ticket_store)
```

Because `lru_cache(maxsize=1)` is used, each service is created exactly once and shared across all
requests. This means `VectorStore` holds one ChromaDB connection for the lifetime of the process.

Ticket persistence uses SQLModel (an ORM built on SQLAlchemy + Pydantic) over an async engine. The
engine is created lazily and shared via `app/db/database.py :: get_engine()`. Request handlers get a
session through the `get_session` dependency (exposed as `SessionDep`); the agent tool path uses
`TicketStore`, which opens its own short-lived session from the same engine.

---

## Configuration Reference

All settings live in `app/core/config.py` and are read from `.env`:

| Setting | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | (dev default in `.env.example`) | HMAC secret for signing access tokens |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Access token lifetime (24 hours) |
| `OPENAI_API_KEY` | (none) | Enables real OpenAI LLM and embedding calls |
| `OPENAI_MODEL` | `gpt-4.1` | Chat completion model when key is set |
| `EMBEDDING_PROVIDER` | `hash` | `hash` / `local` / `openai` / `auto` |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Used when provider is `openai` |
| `LOCAL_EMBEDDING_MODEL` | `BAAI/bge-small-en-v1.5` | Used when provider is `local` |
| `EMBEDDING_DIMENSIONS` | `384` | Vector size; must match the active model |
| `CHROMA_PATH` | `data/chroma` | ChromaDB on-disk directory |
| `CHROMA_COLLECTION` | `enterprise_knowledge` | Collection name inside Chroma |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/enterprise_ai` | Postgres DSN for tickets |
| `TRACE_LOG_PATH` | `logs/traces.jsonl` | Append-only JSONL trace file |
| `RAG_TOP_K` | `5` | Number of chunks retrieved per question |
| `CHUNK_SIZE` | `900` | Characters per chunk |
| `CHUNK_OVERLAP` | `120` | Characters of overlap between adjacent chunks |
| `CORS_ORIGINS` | `http://localhost:3000,...` | Allowed frontend origins (comma-separated) |

`get_settings()` is cached with `lru_cache`. It also auto-creates `data/chroma`, `data/`, and
`logs/` directories on first call, so those paths always exist before any service tries to use them.

---

## Files To Read In Order

1. `backend/app/core/config.py`
   - Defines `Settings` and every configurable knob. Read this first so that every other
     file's `settings.X` reference makes sense.
2. `backend/app/agents/state.py`
   - Defines the shared `AgentState` dictionary that moves through the LangGraph flow.
3. `backend/app/agents/graph.py`
   - Builds the graph. The four node methods (`_router`, `_retriever`, `_tool_caller`,
     `_answer_generator`) live here as methods on the `AgentRunner` class. There is no
     separate `nodes.py` file.
4. `backend/app/agents/tools.py`
   - Contains the three async tool functions explained in this guide.
5. `backend/app/db/fake_database.py`
   - Provides the fake business metrics used by `query_database_tool`.
6. `backend/app/db/models.py` and `backend/app/db/database.py`
   - `models.py` defines the SQLModel `Ticket` table model (plus `TicketBase`/`TicketPublic`).
   - `database.py` builds the async engine and the `get_session` dependency (`SessionDep`).
7. `backend/app/db/tickets.py`
   - Repo helpers (`add_ticket`, `list_tickets`, `get_ticket`) operate on a SQLModel session.
   - `TicketStore` wraps those helpers for the agent tool path (opens its own session).
8. `backend/app/services/rag.py`
   - `RAGService.retrieve` queries ChromaDB. `RAGService.answer` formats context and calls
     OpenAI (or returns a mock answer when no key is set).
9. `backend/app/api/deps.py`
   - Wires all services together via FastAPI's dependency injection with `lru_cache`.
10. `backend/app/api/routes/chat.py`
    - Shows how `/v1/chat` and `/v1/chat/stream` call `AgentRunner.run`.
11. `backend/app/api/routes/tickets.py`
    - Read endpoints that consume `SessionDep` directly (the tutorial session-dependency pattern).

---

## `AgentState`: The Data Envelope

`state.py` defines a `TypedDict` with `total=False`, meaning all keys are optional at any given
moment during the graph run:

```python
class AgentState(TypedDict, total=False):
    conversation_id: str      # conversation this turn belongs to
    question: str             # the user's original chat message
    route: str                # set by _router: "rag" | "database" | "ticket"
    documents: list[dict]     # set by _retriever: chunks from ChromaDB
    tool_results: list[dict]  # set by _tool_caller: outputs of each tool function
    answer: str               # set by _answer_generator: the final response text
    trace_id: str             # UUID created in AgentRunner.run, used for logging
```

Every node receives the full state and returns an updated copy using `{**state, "key": value}`.
LangGraph merges those updates back into the shared state before the next node runs.

---

## Runtime Flow

The full request path from HTTP to response:

```
POST /v1/chat  (or /v1/chat/stream)
    │
    ├── get_current_user        decodes JWT, loads User from Postgres
    │
    ├── resolve conversation    uses conversation_id from request, or creates a new one
    ├── persist user message    writes Message(role="user") to Postgres
    │
    └── AgentRunner.run(request, conversation_id)
            │
            ├── creates AgentState with a fresh trace_id (UUID)
            │
            ├── LangGraph pipeline (linear, no branches):
            │       router → retriever → tool_caller → answer_generator
            │           │
            │           ├── _router           sets state["route"]
            │           ├── _retriever        sets state["documents"]  (always runs)
            │           ├── _tool_caller      sets state["tool_results"]
            │           └── _answer_generator sets state["answer"]
            │
            ├── _citations(documents)  → list of {source, chunk_id, score, page}
            │
            ├── write_trace(...)       → appends one record to logs/traces.jsonl
            │
            ├── persist assistant message (role, answer, route, trace_id, citations, tool_results)
            │
            └── returns ChatResponse {conversation_id, answer, route, citations,
                                      tool_results, trace_id}
```

Important detail: document retrieval always runs for every route. Even ticket and database
questions still receive retrieved document context if matching chunks exist in ChromaDB.

---

## Routing Logic

`_router` uses two private keyword-matching helpers to set `state["route"]`:

**Ticket intent** — requires both an action word AND a ticket noun:
- Action words: `create`, `open`, `file`, `raise`, `log`
- Ticket nouns: `ticket`, `task`, `issue`, `bug`, `incident`

**Database intent** — requires a data keyword OR an aggregate phrase:
- Data keywords: `database`, `revenue`, `mrr`, `employee`, `sla`, `churn`
- Aggregate phrases: `how many`, `count`, `total`, `show`, `report`, `query`

Everything else routes to `rag`.

This is intentional demo-level simplicity. Misclassification of ambiguous requests is a known
limitation (see "Current Limitations" below).

---

## Function: `search_docs_tool`

Purpose:

- Report how many retrieved documents were found.
- Return the top source names from the first three documents.

Input shape:

- `documents`: a list of dictionaries returned by `VectorStore.search`.

Expected document shape:

```python
{
    "text": "...",
    "metadata": {
        "source": "acme_employee_handbook.pdf",
        "chunk_id": "..."
    },
    "score": 0.82
}
```

Output shape:

```python
{
    "documents_found": 3,
    "top_sources": ["acme_employee_handbook.pdf", "runbook.md"]
}
```

Things to notice:

- It is async for consistency with the other tools, even though it does not currently await
  anything.
- It uses defensive `.get(...)` calls so missing metadata does not crash the agent.
- It only looks at the first three documents, which keeps tool output small.

Good first learning change:

- Add `top_scores` to the response so you can see the retrieved relevance scores.

---

## Function: `query_database_tool`

Purpose:

- Wrap `query_fake_database(question)` in an async tool function.

Input shape:

- `question`: the user's chat message.

Output shape:

```python
{
    "table": "revenue",
    "rows": {
        "mrr_usd": 482000,
        "quarterly_growth_pct": 8.4,
        "top_region": "APAC"
    },
    "queried_at": "..."
}
```

Things to notice:

- The actual routing logic lives in `fake_database.py`, not in `tools.py`.
- The fake database chooses a table by keyword matching on the question.
- This is intentionally simple demo code. In production this should become a safe data-access
  layer with authorization, parameterized queries, and tenant filters.

Good first learning change:

- Add one more fake table in `fake_database.py`, then update tests to prove a question routes
  to it.

---

## Function: `create_ticket_tool`

Purpose:

- Convert a user request into a small ticket payload.
- Persist the ticket through `TicketStore`.

Input shape:

- `question`: the user's chat message.
- `ticket_store`: an instance of `TicketStore`.

How the title is created:

- Strip leading and trailing whitespace.
- Take only the first line.
- Limit it to 90 characters.
- Fall back to `Assistant follow-up` if the message is empty.

How priority is created:

- `high` if the question contains `urgent`, `p0`, or `critical`.
- `medium` otherwise.

Output shape:

```python
{
    "id": "...",
    "title": "Create a high priority ticket...",
    "description": "Create a high priority ticket...",
    "priority": "high",
    "status": "open",
    "created_at": "..."
}
```

Things to notice:

- The tool does not directly know about SQLModel or Postgres. It depends on the `TicketStore`
  interface, which wraps the ORM session.
- `TicketStore.create_ticket` handles persistence details.
- This tool has a side effect: it writes data. That makes auth, permissions, idempotency, and
  tests more important than for read-only tools.

Good first learning change:

- Support a `low` priority keyword, then add a ticket-store test that proves it works.

---

## How The Tool Outputs Reach The Model

`AgentRunner._tool_caller` stores results like this:

```python
[
    {"name": "search_docs", "result": {...}},
    {"name": "query_fake_database", "result": {...}},
    {"name": "create_ticket", "result": {...}}
]
```

Then `RAGService._format_context` turns each result into plain text:

```text
[acme_employee_handbook.pdf#abc123:0:xyz] chunk text here...

search_docs: {"documents_found": 3, "top_sources": [...]}
create_ticket: {"id": "...", "title": "...", ...}
```

That formatted tool context is included with document context when the answer is generated by
OpenAI (or the mock answer builder if no key is set).

---

## Services In Depth

### EmbeddingClient (`services/embeddings.py`)

Three embedding strategies, selected by `EMBEDDING_PROVIDER`:

| Mode | When to use | Notes |
|---|---|---|
| `hash` | Default, no dependencies | Deterministic but not semantically meaningful. Good for local dev. |
| `local` | `uv sync --extra local-embeddings` + `EMBEDDING_PROVIDER=local` | Uses fastembed with BAAI/bge-small-en-v1.5. Free, runs on-device. First run downloads the model. |
| `openai` | `OPENAI_API_KEY` set + `EMBEDDING_PROVIDER=openai` | Calls the OpenAI Embeddings API. Best retrieval quality. |
| `auto` | Picks best available: openai → local → hash | Useful when the environment varies. |

**Warning:** switching providers after indexing documents will break retrieval because vector
dimensions differ between models. Always clear `data/chroma` and run `make seed` after switching.

### VectorStore (`services/vector_store.py`)

Wraps ChromaDB's `PersistentClient`. Two async operations:

- `upsert_chunks(chunks)` — embeds chunk texts and upserts into the Chroma collection. Chroma
  deduplicates by chunk `id`, so re-uploading the same file is idempotent.
- `search(query, top_k)` — embeds the query and retrieves the `top_k` nearest chunks.
  Distances are converted to scores with `1.0 / (1.0 + distance)` (higher score = more similar).

All Chroma calls are wrapped in `asyncio.to_thread` because chromadb's Python client is
synchronous and would otherwise block the async event loop.

### RAGService (`services/rag.py`)

Two responsibilities:

1. `retrieve(question)` — delegates to `VectorStore.search`.
2. `answer(question, docs, tool_results)` — formats context from docs and tool results, then
   calls OpenAI with a system prompt instructing citation by `[source#chunk_id]`. Falls back
   to `_mock_answer` if `OPENAI_API_KEY` is absent.

Context format fed to the model:

```
[acme_employee_handbook.pdf#abc123:0:def456] chunk text here...
[runbook.md#xyz789:1:ghi012] more chunk text...

search_docs: {"documents_found": 3, "top_sources": [...]}
create_ticket: {"id": "...", "title": "...", ...}
```

### chunking.py

Splits whitespace-normalized text into fixed-size character windows with overlap.

- `chunk_size=900`, `chunk_overlap=120` by default (from Settings).
- Each chunk gets a stable `id` in the form `{document_id}:{index}:{sha1[:16]}`.
- Overlap ensures sentences that fall near a chunk boundary still appear complete in at least one
  chunk, which reduces retrieval gaps.

### document_loader.py

Supports four file types:
- `.pdf` — uses pypdf, extracts text per page, stores `page_count` in metadata.
- `.docx` — uses python-docx, joins paragraphs, stores `paragraph_count` in metadata.
- `.txt` / `.md` — decoded as UTF-8 with error replacement.

`document_id` is a SHA-1 of the raw file bytes, making chunk upserts idempotent in Chroma when
the same file is uploaded more than once.

### Ticket persistence (`db/models.py`, `db/database.py`, `db/tickets.py`)

Tickets use **SQLModel** (ORM on top of SQLAlchemy + Pydantic) over an async engine backed by
`asyncpg`, configured through `DATABASE_URL`.

`models.py` defines three classes following the tutorial's multiple-models pattern:

- `TicketBase` — shared fields (`title`, `description`, `priority`).
- `Ticket(TicketBase, table=True)` — the table model; adds `id` (UUID string PK), `status`
  (indexed, default `open`), and `created_at` (timezone-aware). This is what maps to the SQL table.
- `TicketPublic(TicketBase)` — the response model returned by the read endpoints.

`database.py` provides the engine and the session dependency:

```python
def get_engine() -> AsyncEngine: ...            # lazily creates one shared async engine
async def create_db_and_tables() -> None: ...   # SQLModel.metadata.create_all at startup

async def get_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSession(get_engine()) as session:
        yield session

SessionDep = Annotated[AsyncSession, Depends(get_session)]
```

`tickets.py` has session-based repo helpers (`add_ticket`, `list_tickets`, `get_ticket`) plus
`TicketStore`. Routes use the repo helpers with an injected `SessionDep`. The agent tool path is not
a request, so `TicketStore.create_ticket` opens its own short-lived `AsyncSession` from the shared
engine, calls `add_ticket`, and returns a plain dict (with `created_at` as an ISO string) to keep
the existing tool-result/streaming contract unchanged.

The generated schema is equivalent to:

```sql
CREATE TABLE tickets (
    id          VARCHAR PRIMARY KEY,
    title       VARCHAR NOT NULL,
    description VARCHAR NOT NULL,
    priority    VARCHAR NOT NULL,
    status      VARCHAR NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_tickets_status ON tickets (status);
```

`create_db_and_tables` uses `create_all`, which only creates missing tables. It does not run
migrations or alter existing tables, so production should adopt Alembic.

---

## Document Upload Flow

```
POST /v1/documents/upload
    │
    ├── load_upload(file)
    │       ├── reads raw bytes from the multipart upload
    │       ├── extracts text by file extension (.pdf, .docx, .txt, .md)
    │       └── returns LoadedDocument(document_id, source, text, metadata)
    │
    ├── chunk_text(text, ...)
    │       └── returns list[TextChunk]
    │
    └── vector_store.upsert_chunks(chunks)
            ├── embeds chunk texts → list of float vectors
            └── upserts into ChromaDB collection
```

After upload the document is immediately available for retrieval in subsequent chat requests.
No server restart is needed.

---

## Chat Streaming

`POST /v1/chat/stream` returns a Server-Sent Events (SSE) stream. The current implementation
runs the full agent to completion first, then splits the final answer word-by-word into
`event: token` messages, followed by one `event: done` message with citations, tool results,
trace ID, and route.

```
event: token
data: {"type": "token", "text": "Hello "}

event: token
data: {"type": "token", "text": "world "}

event: done
data: {"type": "done", "conversation_id": "...", "citations": [...], "tool_results": [...], "trace_id": "...", "route": "rag"}
```

This is simulated streaming, not true token-level streaming from the LLM. For real streaming,
`RAGService.answer` would need to call `client.responses.create(..., stream=True)` and yield
chunks progressively.

---

## Telemetry

`telemetry/tracing.py :: write_trace` is called at the end of every `AgentRunner.run`. It appends
one JSON record per request to `logs/traces.jsonl`:

```json
{
    "timestamp": "2026-06-12T07:00:00+00:00",
    "trace_id": "...",
    "conversation_id": "...",
    "route": "rag",
    "question": "What is the refund SLA?",
    "answer_chars": 312,
    "tool_count": 1,
    "citation_count": 3,
    "estimated_tokens": 450,
    "estimated_cost_usd": 0.0009
}
```

Token and cost estimates are rough (`len(text) // 4`, no actual API usage data). The file is
gitignored. For production observability, replace `write_trace` with LangSmith, OpenTelemetry,
or a cloud logging platform.

---

## Schemas Reference

### `schemas/chat.py`

| Class | Direction | Key fields |
|---|---|---|
| `ChatRequest` | request body | `conversation_id` (optional), `message`, `history` |
| `ChatResponse` | response body | `conversation_id`, `answer`, `route`, `citations`, `tool_results`, `trace_id` |
| `Citation` | inside `ChatResponse` | `source`, `chunk_id`, `score`, `page` |
| `ToolResult` | inside `ChatResponse` | `name`, `result` |
| `ChatMessage` | inside `ChatRequest.history` | `role` (user/assistant/system), `content` |

Note: `history` is accepted in `ChatRequest` but not yet consumed by the agent graph. Multi-turn
context is persisted via `Conversation` / `Message` records and loaded through
`GET /v1/conversations/{id}`; wiring prior messages into the LLM prompt is still a follow-up.

### `schemas/auth.py`

| Class | Direction | Key fields |
|---|---|---|
| `RegisterRequest` | request body | `email`, `password`, `full_name` (optional) |
| `LoginRequest` | request body | `email`, `password` |
| `TokenResponse` | response body | `access_token`, `token_type` |
| `UserPublic` | response body | `id`, `email`, `full_name`, `created_at` |

### `schemas/conversation.py`

| Class | Direction | Key fields |
|---|---|---|
| `ConversationSummary` | list item | `id`, `title`, `created_at`, `updated_at` |
| `ConversationDetail` | response body | summary fields + `messages` |
| `MessagePublic` | inside detail | `id`, `role`, `content`, `route`, `trace_id`, `citations`, `tool_results` |

### `schemas/documents.py`

| Class | Direction | Key fields |
|---|---|---|
| `DocumentUploadResponse` | response body | `document_id`, `source`, `chunks_indexed` |

### `db/models.py` (SQLModel)

| Class | Role | Key fields |
|---|---|---|
| `User` | table model | `id`, `email`, `hashed_password`, `full_name`, `created_at` |
| `Conversation` | table model | `id`, `user_id`, `title`, `created_at`, `updated_at` |
| `Message` | table model | `id`, `conversation_id`, `role`, `content`, `route`, `trace_id`, `citations`, `tool_results` |
| `TicketBase` | shared base (not a table) | `title`, `description`, `priority` |
| `Ticket` | table model (`table=True`) | adds `id`, `status`, `created_at` |
| `TicketPublic` | response model for `GET /v1/tickets` | `id`, `title`, `description`, `priority`, `status`, `created_at` |

---

## Current Limitations

- Tool routing is keyword-based and can misclassify ambiguous requests.
- `search_docs_tool` summarizes retrieval results but does not enforce evidence quality.
- `query_database_tool` uses a fake in-memory database.
- `create_ticket_tool` does not yet enforce per-user permissions, tenant/workspace scope, or duplicate prevention (JWT protects the API, but the tool itself is not user-scoped).
- Ticket priority extraction is basic keyword matching.
- Tool output is passed to the model as raw dictionary text instead of a stricter schema.
- `POST /v1/chat/stream` simulates streaming by splitting the completed answer word-by-word.
- `ChatRequest.history` is accepted but not used by the agent graph; prior turns are stored in Postgres but not yet injected into the LLM prompt.
- Token and cost estimates in traces are approximations (`len(text) // 4`).

---

## Production Direction

When moving this code toward production:

- Pass authenticated user/tenant context into every tool call (JWT protects routes; tools still need scoped data access).
- Make side-effect tools check user permissions before writing data.
- Replace `fake_database.py` with a real data-access layer.
- Add tenant and workspace filters to database and retrieval tools.
- Validate tool inputs and outputs with typed schemas.
- Add idempotency keys for ticket creation.
- Log tool success/failure metadata without logging sensitive user content.
- Replace `write_trace` with a structured observability platform.
- Implement real token streaming in `RAGService.answer`.
- Inject stored conversation messages into the LLM prompt for true multi-turn answers.

---

## Suggested Tests

Add or expand tests for:

- `search_docs_tool` with empty documents.
- `search_docs_tool` with missing metadata.
- `query_database_tool` for each supported fake table.
- `create_ticket_tool` title truncation.
- `create_ticket_tool` priority detection.
- `create_ticket_tool` empty-question fallback title.
- `AgentRunner._tool_caller` route behavior for `rag`, `database`, and `ticket`.
- `chunk_text` with overlap larger than chunk_size (should raise).
- `VectorStore.search` score conversion from Chroma distances.
- `EmbeddingClient` hash provider produces deterministic vectors.

---

## Tiny Reading Exercise

To check your understanding, trace this question through the code:

```text
Create an urgent ticket for a failed enterprise import.
```

Expected path:

1. `_router` sees action word `create` + ticket noun `ticket` → sets `route` to `ticket`.
2. `_retriever` still retrieves document chunks (retrieval always runs).
3. `_tool_caller` calls `search_docs_tool` (always called).
4. `_tool_caller` calls `create_ticket_tool` because `route == "ticket"`.
5. `create_ticket_tool` finds `urgent` → sets `priority` to `high`.
6. `TicketStore.create_ticket` writes the ticket to the Postgres `tickets` table.
7. `RAGService.answer` receives both document context and the ticket tool output.
8. `write_trace` appends a record to `logs/traces.jsonl`.
9. `ChatResponse` is returned with `route="ticket"`, citations, and the new ticket in
   `tool_results`.
