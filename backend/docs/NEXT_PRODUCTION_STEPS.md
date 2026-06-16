# Next Production Implementation Plan

This document captures the next production hardening work for the Enterprise AI Assistant backend.
It is intentionally written as an implementation backlog, not a status report.

## Recommended Order

1. Add real auth and tenant-aware data boundaries.
2. Add upload validation and safe ingestion error handling.
3. Add retrieval guardrails and no-evidence behavior.
4. Replace fake persistence with Postgres-backed stores.
5. Move large document ingestion to an async queue.
6. Replace simulated chat streaming with provider/native token streaming.
7. Add focused tests and eval gates for the production behaviors.

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

## 7. Tests And Evals

Target coverage:

- Upload validation: size limit, extension allowlist, MIME sniffing, corrupt file handling, empty text.
- Auth: missing token, invalid token, tenant isolation, workspace filters, permission failures.
- Routing: RAG, database, ticket creation, ambiguous requests, and regression cases.
- Retrieval: score thresholds, reranker ordering, no-evidence responses, citation validation.
- Side-effect tools: authorization, idempotency, persistence, and failure behavior.
- Streaming: token events, done event, error event, cancellation, and metadata parity.
- Postgres: migrations, repository behavior, transaction rollback, and test isolation.
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
