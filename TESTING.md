# Testing Guide

How to test the Enterprise AI Assistant end to end: automated checks, manual API tests, and the
frontend UI. Commands run from the repo root.

The app has three moving parts:

- **Postgres** — stores users, conversations, tickets and support requests (the backend creates
  tables on startup, so it must be running first).
- **Backend** — FastAPI API on `http://localhost:8000`.
- **Frontend** — Vite + React UI on `http://localhost:5173`.

Every route except `/health` needs a JWT from `/v1/auth/register` or `/v1/auth/login` (see 4.1).

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

Without `OPENAI_API_KEY` the app still runs: answers quote the best-matching source sentences, so
every flow below is testable offline. Postgres is always required.

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

### 4.1 Get a token

Set `ADMIN_EMAILS=you@acme.example` in `backend/.env` (and restart) so this account can upload
documents, then register. Use `/v1/auth/login` with the same body (minus `full_name`) next time.

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@acme.example","password":"choose-a-password","full_name":"Your Name"}' \
  | python3 -c 'import json, sys; print(json.load(sys.stdin)["access_token"])')
```

`/health` needs no token:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### 4.2 Upload a document (admin)

```bash
curl -X POST http://localhost:8000/v1/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@backend/docs/demo_upload/acme_parental_leave_policy_2026.pdf" \
  -F "source=acme_parental_leave_policy_2026.pdf"
```

Expect a JSON body with `document_id`, `source`, and `chunks_indexed > 0`. A member account gets
`403`.

### 4.3 Chat — RAG route

```bash
curl -X POST http://localhost:8000/v1/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"How many PTO days carry over to next year?"}'
```

Check the response: `route` should be `rag`, `citations` should be populated after seeding, and a
`trace_id` is returned.

### 4.4 Chat — database route

```bash
curl -X POST http://localhost:8000/v1/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is current MRR revenue?"}'
```

Expect `route` = `database` and a `query_metrics` entry in `tool_results`.

### 4.5 Chat — ticket route (write path)

```bash
curl -X POST http://localhost:8000/v1/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Create an urgent ticket: my laptop screen is cracked."}'
```

Expect `route` = `ticket` and a `create_ticket` entry in `tool_results` with `priority` = `high`.

### 4.6 Streaming chat (SSE)

```bash
curl -N -X POST http://localhost:8000/v1/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the hotel limit in London?"}'
```

You should see a series of `event: token` lines, an `event: done` line with citations, tool
results, route and trace id, then an `event: suggestions` line with follow-up questions.

### 4.7 Read tickets (verifies persistence)

```bash
# list (newest first)
curl http://localhost:8000/v1/tickets \
  -H "Authorization: Bearer $TOKEN"

# fetch one by id (use an id returned above)
curl http://localhost:8000/v1/tickets/<ticket_id> \
  -H "Authorization: Bearer $TOKEN"
```

The ticket you created in 4.5 should appear here, confirming it was written to Postgres.

### 4.8 Auth check (negative test)

```bash
curl -i http://localhost:8000/v1/tickets
# HTTP/1.1 401 Unauthorized
```

### Interactive docs

Open `http://localhost:8000/docs` to try every endpoint from Swagger UI (use the "Authorize" button
with the token from 4.1).

---

## 5. Frontend UI testing

Open `http://localhost:5173` and verify:

1. **Ask a RAG question** (`How many PTO days carry over to next year?`) and confirm the streamed
   answer, the citations and the follow-up suggestions render.
2. **Ask something the docs miss** (`How many weeks of parental leave do I get?`), click "Request
   this document", then as an admin **upload**
   `backend/docs/demo_upload/acme_parental_leave_policy_2026.pdf` and reply from the Inbox.
3. **Ask a database question** (`What is current MRR revenue?`) and confirm tool output appears.
4. **Create a ticket** (`Create a high priority ticket for a failed import.`) and confirm the tool
   result shows.

Default frontend config (`frontend/.env`): API base `http://localhost:8000`. The widget on a sample
intranet is at `http://localhost:5173/hub/`.

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
| `401 Unauthorized` | Missing or expired JWT. Log in again (`/v1/auth/login`) and send `Authorization: Bearer <token>`. If `JWT_SECRET` changed, old tokens stop working. |
| `403 Forbidden` on upload | The account is a member. Add its email to `ADMIN_EMAILS` before registering it. |
| Port `5433` already in use | Another container/process holds it. Change the host port in `backend/docker-compose.yml` and the `DATABASE_URL` port in `backend/.env`. |
| Empty `citations` in chat responses | Knowledge base not seeded. Run `make seed` in `backend/`. |
| Poor retrieval after changing embedding model | Clear `backend/data/chroma` and re-seed (vector dimensions differ between models). |
| Frontend can't reach API | Check `VITE_API_BASE_URL` in `frontend/.env` and that the backend is on `:8000`. |
