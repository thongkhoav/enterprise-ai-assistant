# Next Production Implementation Plan

This document captures the next production hardening work for the Enterprise AI Assistant backend.
It is intentionally written as an implementation backlog, not a status report.

## Recommended Order

1. Add real auth and tenant-aware data boundaries. *(done: JWT auth + conversations)*
2. Add upload validation and safe ingestion error handling.
3. Add retrieval guardrails and no-evidence behavior.
4. Replace fake persistence with Postgres-backed stores.
5. Move large document ingestion to an async queue.
6. Replace simulated chat streaming with provider/native token streaming.
7. Add agent memory: inject conversation history into the LLM prompt.
8. Add agentic routing: ReAct loop with LLM-driven tool selection.
9. Add focused tests and eval gates for the production behaviors.

Auth comes first because tenant and workspace context should flow through uploads, retrieval, tools,
database writes, tracing, and tests.

## 1. Upload Validation

Current entry points:

- `backend/app/api/routes/documents.py`
- `backend/app/services/document_loader.py`
- `backend/app/services/chunking.py`
- `backend/app/schemas/documents.py`
- `backend/app/core/config.py`

Implementation tasks:

- Add settings for `MAX_UPLOAD_BYTES`, allowed extensions, and allowed MIME types.
- Accept only known document types, for example `.txt`, `.md`, `.pdf`, and `.docx`.
- Do not trust `UploadFile.content_type` by itself. Sniff file bytes and confirm they match the
  extension and declared MIME type.
- Read uploads with a bounded size check instead of loading unlimited bytes into memory.
- Catch parser failures from PDF and DOCX loading and return stable `400` or `422` API errors.
- Reject encrypted PDFs, empty files, files with no extractable text, and unsupported encodings.
- Add structured error codes so the frontend can show precise failure messages.
- Consider malware scanning before production if uploaded files are stored or retained.

Acceptance checks:

- Oversized uploads are rejected before indexing.
- Unsupported extensions are rejected.
- Mismatched extension and MIME signatures are rejected.
- Corrupt PDFs/DOCX files return a controlled API error.
- Empty or non-extractable documents are not indexed.

## 2. Real Auth And Tenant Access

Current entry points:

- `backend/app/api/deps.py`
- `backend/app/api/routes/chat.py`
- `backend/app/api/routes/documents.py`
- `backend/app/agents/graph.py`
- `backend/app/services/vector_store.py`
- `backend/app/db/tickets.py`

Implementation tasks:

- Replace the demo bearer token with real user authentication, such as OIDC/JWT.
- Introduce an authenticated request context containing `user_id`, `workspace_id`, `tenant_id`,
  roles, and permissions.
- Store `tenant_id`, `workspace_id`, `owner_user_id`, and document visibility metadata for every
  uploaded document.
- Apply per-document access filters during vector search, not just at upload time.
- Apply authorization checks before side-effect tools such as ticket creation.
- Include auth context in traces without logging raw tokens or sensitive claims.
- Add rate limits per user and workspace.

Acceptance checks:

- A user cannot retrieve chunks from another tenant or workspace.
- Upload metadata is stamped with the authenticated tenant/workspace.
- Tool side effects fail closed when the user lacks permission.
- Unauthorized and forbidden responses are distinguishable.

## 3. Real Streaming

Current entry points:

- `backend/app/api/routes/chat.py`
- `backend/app/agents/graph.py`
- `backend/app/services/rag.py`

Implementation tasks:

- Replace post-hoc `answer.split(" ")` streaming with real provider or local-model streaming.
- Add an async streaming path through `AgentRunner` and `RAGService`.
- Stream structured events for route, retrieval, tool calls, model tokens, errors, and done.
- Preserve the non-streaming `/v1/chat` route for clients that need one-shot responses.
- Ensure the final `done` event includes citations, tool results, trace ID, and route.
- Add cancellation handling so disconnected clients stop unnecessary model work.

Acceptance checks:

- Tokens arrive before the full model response is complete.
- Stream errors are serialized as events and logged.
- The final stream metadata matches the non-streaming response shape.
- Client disconnects do not leave long-running model calls or ingestion work behind.

## 4. Retrieval Guardrails

Current entry points:

- `backend/app/services/rag.py`
- `backend/app/services/vector_store.py`
- `backend/app/agents/graph.py`
- `backend/evals/questions.jsonl`

Implementation tasks:

- Add a configurable retrieval score threshold.
- Filter low-confidence chunks before answer generation.
- Add an optional reranker after initial vector search.
- Return an explicit empty-context response when no evidence passes the threshold.
- Enforce that generated citations reference retrieved chunks only.
- Add a post-generation citation validator and fail-safe retry or fallback response.
- Track retrieval metrics, including empty-context rate, citation coverage, and top-k latency.

Acceptance checks:

- No-evidence questions do not produce unsupported answers.
- Answers with citations only cite chunks actually returned by retrieval.
- Low-scoring chunks are not passed to the model.
- Eval cases cover expected-source retrieval and empty-context behavior.

## 5. Async Ingestion Queue

Current entry points:

- `backend/app/api/routes/documents.py`
- `backend/app/services/document_loader.py`
- `backend/app/services/vector_store.py`

Implementation tasks:

- Store original uploads in object storage or durable local storage for development.
- Add document and ingestion job tables with statuses such as `pending`, `processing`, `indexed`,
  and `failed`.
- Change large uploads to return `202 Accepted` with a job/document ID.
- Add a job status endpoint for the frontend.
- Move parsing, chunking, embedding, and vector upsert into a worker.
- Choose a queue backend such as Celery/RQ, Temporal, or a managed cloud queue.
- Make ingestion idempotent by document digest and tenant/workspace scope.

Acceptance checks:

- Large uploads do not block request workers.
- Failed ingestion jobs retain a useful error state.
- Re-uploading the same document does not duplicate chunks unexpectedly.
- The frontend can poll or subscribe to ingestion status.

## 6. Postgres Persistence

Current entry points:

- `backend/app/db/tickets.py`
- `backend/app/db/fake_database.py`
- `backend/app/agents/tools.py`
- `backend/app/core/config.py`

Implementation tasks:

- Add Postgres settings and local Docker Compose configuration. (done: `DATABASE_URL` + compose `db` service)
- Introduce migrations, preferably with Alembic.
- Ticket store is now Postgres-backed via the SQLModel ORM over asyncpg (`app/db/`).
- Replace `fake_database.py` with real read models or a safe data-access layer.
- Use parameterized queries and least-privilege database credentials.
- Add tenant/workspace columns and indexes to persisted records.
- Consider pgvector if the team wants Postgres to own vector search too.

Acceptance checks:

- Ticket creation persists in Postgres.
- Fake database answers are replaced by real, tested data access.
- Migrations create all required tables and indexes from a clean database.
- Tests can run against an isolated test database.

## 7. Agent Memory: Conversation History

Current entry points:

- `backend/app/agents/graph.py`
- `backend/app/agents/state.py`
- `backend/app/api/routes/chat.py`
- `backend/app/db/conversations.py`

### What is missing

The `Message` table stores every user and assistant turn per conversation, but the graph does not
read it back. Each invocation starts from a blank `AgentState`, so the model cannot reference
anything said in prior turns. Asking "now calculate 10% more than that" after a revenue answer
produces no useful response.

### Two implementation options

**Option A — LangGraph built-in checkpointer (recommended)**

LangGraph ships checkpointers that save and restore full `AgentState` automatically, keyed by a
`thread_id`. Use the async Postgres checkpointer so state lives in the same database as everything
else.

```python
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

async with AsyncPostgresSaver.from_conn_string(settings.database_url) as checkpointer:
    graph = builder.compile(checkpointer=checkpointer)

# Pass thread_id = conversation_id on every invocation
result = await graph.ainvoke(
    initial_state,
    config={"configurable": {"thread_id": conversation_id}},
)
```

LangGraph replays the stored state before the graph runs — the agent sees prior questions and
answers automatically. No manual history injection is needed.

**Option B — inject `Message` rows into `AgentState`**

Load the last N messages from `conversations.list_messages` before calling `graph.ainvoke` and
add them to `state["history"]`. The answer generator passes them to the LLM as prior chat turns.

```python
messages = await list_messages(session, conversation_id=conversation_id)
history = [{"role": m.role, "content": m.content} for m in messages[-10:]]
initial = {**initial_state, "history": history}
```

This reuses your existing Postgres tables but requires wiring `history` into `AgentState` and the
LLM prompt manually.

Option A is less code and stays in sync with LangGraph's execution model. Option B gives more
control over what history is injected and avoids a new dependency on the checkpointer schema.

### Implementation tasks

- Add `history: list[dict]` to `AgentState`.
- Choose Option A or B above.
- Wire loaded history into the LLM context in `_answer_generator` (`RAGService.answer`).
- Limit history window to a configurable token budget to avoid context overflow.
- Add a setting `MAX_HISTORY_TURNS` (default: 10).
- Ensure history is scoped to the authenticated user's conversation (never leaks across users).

### Acceptance checks

- A follow-up question that references a prior answer resolves correctly.
- History from another user's conversation is never injected.
- Requests with no prior turns work identically to today.
- Token usage does not spike unboundedly as conversations grow.

---

## 8. Agentic Routing: ReAct Loop With LLM Tool Selection

Current entry points:

- `backend/app/agents/graph.py`
- `backend/app/agents/tools.py`
- `backend/app/agents/state.py`

### What is missing

The current router uses keyword rules to classify every question into exactly one route
(`rag`, `database`, `ticket`). This means:

- Compound questions spanning multiple tools are not handled ("What is MRR and create a ticket if
  it dropped below target?").
- The LLM never decides which tools to invoke — it only generates the final text.
- Adding a new tool requires new keyword rules and a new `if` branch.

### The ReAct pattern

ReAct (Reason + Act) adds a cycle to the graph. The LLM reasons about the question, decides which
tool to call next, sees the result, and repeats until it has enough context for a final answer.

```
┌─────────────────────────────┐
│                             │
▼                             │
LLM node (function calling)   │   tool result → back to LLM
│                             │
│  tool_calls in response ────┘
│
│  no tool_calls → done
▼
Final answer
```

In LangGraph this is a conditional edge:

```python
def should_continue(state: AgentState) -> str:
    if state.get("pending_tool_calls"):
        return "tool_executor"   # loop back
    return END

builder.add_conditional_edges("llm_node", should_continue)
builder.add_edge("tool_executor", "llm_node")  # always returns to LLM
```

The LLM signals it is done by producing a response with no tool calls.

### Parallel tool calls

OpenAI function calling can return multiple tool calls in a single response. These can be executed
concurrently and returned to the LLM in one batch, saving round-trips for independent tools:

```python
tool_calls = state["pending_tool_calls"]  # e.g. [query_database, search_docs]
results = await asyncio.gather(*[run_tool(tc) for tc in tool_calls])
```

### When to switch from keyword routing

The current keyword router is sufficient while:
- The tool set is small (≤ 3-4 tools).
- Intent boundaries are clear.
- Predictability and testability matter more than flexibility.

Switch to LLM-driven tool selection when:
- Keyword heuristics are becoming complex to maintain.
- Users ask compound or ambiguous questions that span multiple tools.
- You need multi-step reasoning across more than two tools.

### Implementation tasks

- Define each tool as an OpenAI function schema (name, description, parameters JSON schema).
- Replace `_router` + `_tool_caller` with an `llm_node` that calls the model with tools attached.
- Add a `tool_executor` node that dispatches tool calls by name and returns results.
- Add `pending_tool_calls` and `tool_messages` to `AgentState`.
- Add a conditional edge from `llm_node` → `tool_executor` or `END`.
- Add an edge from `tool_executor` back to `llm_node`.
- Add a max-iteration guard to prevent infinite loops (`MAX_AGENT_ITERATIONS`, default: 6).
- Keep side-effect tools (`create_ticket`) behind an explicit user-intent check before execution.
- Preserve the retriever step so RAG context is still injected at the start.

### Acceptance checks

- A compound question invokes multiple tools in one conversation turn.
- The agent stops and produces a final answer without an extra LLM call when no tool is needed.
- The max-iteration guard halts runaway loops and returns a graceful error.
- Side-effect tools are only called when the user clearly intended the action.
- Traces record each tool call and result in order.

---

## 9. Tests And Evals

Target coverage:

- Upload validation: size limit, extension allowlist, MIME sniffing, corrupt file handling, empty text.
- Auth: missing token, invalid token, tenant isolation, workspace filters, permission failures.
- Routing: RAG, database, ticket creation, ambiguous requests, and regression cases.
- Retrieval: score thresholds, reranker ordering, no-evidence responses, citation validation.
- Side-effect tools: authorization, idempotency, persistence, and failure behavior.
- Streaming: token events, done event, error event, cancellation, and metadata parity.
- Postgres: migrations, repository behavior, transaction rollback, and test isolation.
- Agent memory: follow-up questions resolve against prior turns; history is scoped to the correct user.
- Agentic routing: compound questions invoke multiple tools; max-iteration guard halts runaway loops.
- Evals: expected route, expected citation source, no-evidence cases, and answer quality checks.

Useful commands:

```bash
cd backend
uv run ruff check .
uv run pytest
uv run python -m scripts.run_eval
```

Definition of done:

- New production behavior is covered by tests.
- Security-sensitive defaults fail closed.
- Traces expose enough metadata to debug without leaking sensitive content.
- The frontend receives stable error shapes for validation, auth, streaming, and ingestion failures.
