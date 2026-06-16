# Start Here

This project is meant to help you learn the job-description skills in a practical order.

## Week 1: FastAPI Backend

- Understand `app/main.py`, routes, dependencies, and auth.
- Study the existing `GET /v1/tickets` route in `app/api/routes/tickets.py` and the `get_session`
  dependency, then extend it, for example add `POST /v1/tickets` or filter by `status`.
- Write tests for the endpoint.

## Week 2: RAG Basics

- Read the core RAG services and what each function does:
- `app/services/document_loader.py` — turns raw files into text.
  - `load_upload(file)` — async; reads an uploaded file, extracts text by extension, returns a
    `LoadedDocument` whose `document_id` is a SHA-1 of the bytes (so re-uploads are idempotent).
  - `load_file(path)` — same as above but for a file on disk (used by the seed script).
  - `_extract_text(content, suffix)` — picks the parser: PDF via `pypdf` (per page), DOCX via
    `python-docx` (paragraphs), otherwise decodes as UTF-8. Returns `(text, metadata)`.
  - `LoadedDocument` — dataclass holding `document_id`, `source`, `text`, `metadata`.
- `app/services/chunking.py` — splits text into retrievable pieces.
  - `chunk_text(...)` — normalizes whitespace, then slices the text into fixed-size character
    windows with overlap; raises if `overlap >= chunk_size`; gives each chunk a stable id.
  - `TextChunk` — dataclass holding `id`, `text`, `source`, `document_id`, `metadata`
    (includes `chunk_index`).
- `app/services/embeddings.py` — converts text into vectors.
  - `EmbeddingClient` — chooses an embedding provider from settings.
  - `embed_texts(texts)` — async; routes to OpenAI, a local fastembed model (run in a thread),
    or the offline `hash` fallback.
  - `_resolve_provider()` — for `auto`, prefers OpenAI → local → hash; errors if `openai` is
    forced without a key.
  - `_hash_embedding(text)` — deterministic dependency-free vector for local bootstrapping/tests.
  - `_load_local_model()` / `_embed_local()` / `_fastembed_available()` — lazy fastembed handling.
- `app/services/vector_store.py` — stores and searches vectors in Chroma.
  - `VectorStore` — wraps a persistent Chroma collection.
  - `upsert_chunks(chunks)` — async; embeds chunk texts and upserts them (idempotent by chunk id).
  - `search(query, top_k)` — async; embeds the query and returns the `top_k` nearest chunks as
    `{text, metadata, score}`.
  - `_metadata_for(chunk)` — builds Chroma-safe metadata (keeps only scalar values).
  - `_normalize_results(result)` — converts Chroma distances to a `score` of `1 / (1 + distance)`.
- Upload different file types.
- Tune `CHUNK_SIZE`, `CHUNK_OVERLAP`, and `RAG_TOP_K`.
- Try `EMBEDDING_PROVIDER=local` with `LOCAL_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5`.
- Clear `data/chroma` and seed again when changing embedding model/provider.

## Week 3: Agent AI

- Read `app/agents/graph.py`.
- Add a new route, for example `analytics`.
- Add one more tool and call it from `tool_caller`.

## Week 4: Evaluation

- Expand `evals/questions.jsonl` to 50 business questions.
- Track route accuracy, citation presence, and answer keyword matches.
- Add a retrieval quality metric: expected source in top 3.

## Week 5: Production Readiness

- Tickets already use Postgres via the SQLModel ORM (`app/db/`); add Alembic migrations and
  tenant/workspace columns on top of it.
- Add proper user authentication.
- Add OpenTelemetry or LangSmith.
- Deploy with Docker Compose or Kubernetes.
