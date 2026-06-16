# Testing Guide

How to test the Enterprise AI Assistant end to end: automated checks, manual API tests, and the
frontend UI. Commands assume the repo root at
`/Users/rio/Documents/coding/enterprise-ai-assistant`.

The app has three moving parts:

- **Postgres** — stores tickets (the backend creates tables on startup, so it must be running first).
- **Backend** — FastAPI API on `http://localhost:8000`.
- **Frontend** — Vite + React UI on `http://localhost:5173`.

The default API key is `dev-secret` (`APP_API_KEY` in `backend/.env`).

---

## 1. Prerequisites

- Python 3.11+ and [`uv`](https://docs.astral.sh/uv/)
- Node.js 20+
- Docker Desktop (used to run Postgres locally)

---

## 2. Start the stack (local dev)

### 2.1 Start Postgres

The backend's Compose file includes a `db` service on host port `5433` (chosen so it does not clash
with a local Postgres on `5432`):

```bash
cd backend
docker compose up -d db
```

This matches the default `DATABASE_URL` in `backend/.env.example`
(`postgresql://postgres:postgres@localhost:5433/enterprise_ai`).

### 2.2 Start the backend

```bash
cd backend
uv sync --extra dev
cp .env.example .env       # first time only
make seed                  # index sample knowledge into Chroma
make dev                   # serves http://localhost:8000
```

Without `OPENAI_API_KEY` the app still runs: it uses deterministic local embeddings and returns a
mock answer, so every flow below is testable offline. Tickets still require Postgres.

### 2.3 Start the frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env        # first time only
npm run dev                 # serves http://localhost:5173
```

---

## 3. Automated tests (backend)

```bash
cd backend
make test     # pytest
make lint     # ruff check
make format   # ruff format + autofix
```

`make test` does not require Postgres or network access. Expected: all tests pass.

### Evals

With the backend running (`make dev`) in another terminal:

```bash
cd backend
make eval
```

The eval runner checks route selection and keyword presence against `evals/questions.jsonl`.

---

## 4. Manual API tests (curl)

All routes except `/health` require the `Authorization: Bearer dev-secret` header.

### 4.1 Health (no auth)

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### 4.2 Upload a document

```bash
curl -X POST http://localhost:8000/v1/documents/upload \
  -H "Authorization: Bearer dev-secret" \
  -F "file=@backend/docs/sample_policy.md" \
  -F "source=sample_policy.md"
```

Expect a JSON body with `document_id`, `source`, and `chunks_indexed > 0`.

### 4.3 Chat — RAG route

```bash
curl -X POST http://localhost:8000/v1/chat \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test","message":"What is the refund SLA policy?"}'
```

Check the response: `route` should be `rag`, `citations` should be populated after seeding, and a
`trace_id` is returned.

### 4.4 Chat — database route

```bash
curl -X POST http://localhost:8000/v1/chat \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test","message":"What is current MRR revenue?"}'
```

Expect `route` = `database` and a `query_fake_database` entry in `tool_results`.

### 4.5 Chat — ticket route (write path)

```bash
curl -X POST http://localhost:8000/v1/chat \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test","message":"Create an urgent ticket for a failed enterprise import."}'
```

Expect `route` = `ticket` and a `create_ticket` entry in `tool_results` with `priority` = `high`.

### 4.6 Streaming chat (SSE)

```bash
curl -N -X POST http://localhost:8000/v1/chat/stream \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test","message":"Summarize the refund policy."}'
```

You should see a series of `event: token` lines followed by a final `event: done` line containing
citations, tool results, route, and trace id.

### 4.7 Read tickets (verifies persistence)

```bash
# list (newest first)
curl http://localhost:8000/v1/tickets \
  -H "Authorization: Bearer dev-secret"

# fetch one by id (use an id returned above)
curl http://localhost:8000/v1/tickets/<ticket_id> \
  -H "Authorization: Bearer dev-secret"
```

The ticket you created in 4.5 should appear here, confirming it was written to Postgres.

### 4.8 Auth check (negative test)

```bash
curl -i http://localhost:8000/v1/tickets
# HTTP/1.1 401 Unauthorized
```

### Interactive docs

Open `http://localhost:8000/docs` to try every endpoint from Swagger UI (use the "Authorize" button
with `dev-secret`).

---

## 5. Frontend UI testing

Open `http://localhost:5173` and verify:

1. **Upload** a document (e.g. `backend/docs/sample_policy.md`) and confirm it indexes.
2. **Ask a RAG question** (`What is the refund SLA policy?`) and confirm the streamed answer plus
   citations render.
3. **Ask a database question** (`What is current MRR revenue?`) and confirm tool output appears.
4. **Create a ticket** (`Create a high priority ticket for a failed import.`) and confirm the tool
   result shows.

Default frontend config (`frontend/.env`): API base `http://localhost:8000`, key `dev-secret`. If
requests return 401, make sure `VITE_API_KEY` matches `APP_API_KEY` in `backend/.env`.

---

## 6. Verify data and traces

### Tickets in Postgres

```bash
cd backend
docker compose exec db psql -U postgres -d enterprise_ai -c "SELECT id, title, priority, status, created_at FROM tickets ORDER BY created_at DESC;"
```

### Trace log

Every chat request appends a JSON line with route, counts, and rough token/cost estimates:

```bash
tail -n 5 backend/logs/traces.jsonl
```

### Vector store

Chroma persists under `backend/data/chroma`. If you switch embedding providers/models, clear it and
re-seed:

```bash
cd backend
rm -rf data/chroma
make seed
```

---

## 7. Reset local state

```bash
cd backend
rm -rf data/chroma logs/traces.jsonl
docker compose down -v db   # drops the Postgres volume (wipes tickets)
docker compose up -d db
make seed
```

---

## 8. Docker options

### Backend + Postgres together

```bash
cd backend
cp .env.example .env
docker compose up --build
```

This starts Postgres and the API together; the API waits for the database to be healthy. Then run
the frontend separately with `npm run dev`.

### Full stack (root compose) — known gap

The root `docker-compose.yml` currently builds **backend + frontend only and does not include a
Postgres service**. Because the backend now creates its tables on startup, `docker compose up`
from the repo root will fail at backend startup with a database connection error.

Until a `db` service is added to the root compose, use the local-dev flow in Section 2, or the
backend-only Compose above plus `npm run dev` for the frontend.

---

## 9. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Backend exits on startup with a DB connection error | Postgres isn't running. Run `cd backend && docker compose up -d db`. |
| `401 Unauthorized` | Missing/wrong bearer token. Use `Authorization: Bearer dev-secret`; ensure frontend `VITE_API_KEY` matches backend `APP_API_KEY`. |
| Port `5433` already in use | Another container/process holds it. Change the host port in `backend/docker-compose.yml` and the `DATABASE_URL` port in `backend/.env`. |
| Empty `citations` in chat responses | Knowledge base not seeded. Run `make seed` in `backend/`. |
| Poor retrieval after changing embedding model | Clear `backend/data/chroma` and re-seed (vector dimensions differ between models). |
| Frontend can't reach API | Check `VITE_API_BASE_URL` in `frontend/.env` and that the backend is on `:8000`. |
