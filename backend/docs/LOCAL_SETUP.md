# Local Backend Setup Guide

This guide gets the FastAPI backend running on a developer machine with `uv`, Chroma, sample seed
documents, and optional local embeddings.

## Prerequisites

- Python 3.11 or newer
- `uv`
- Docker Desktop (used to run Postgres locally, and optionally the whole stack via Docker Compose)
- Optional: Node.js 20 if you also run the React frontend

Install `uv` on macOS:

```bash
brew install uv
```

Verify:

```bash
uv --version
```

## Install Dependencies

```bash
cd backend
uv sync --extra dev
```

`uv` creates and manages the project environment. You do not need to manually create or activate a
virtualenv.

## Configure Environment

```bash
cp .env.example .env
```

Minimum local values:

```bash
APP_ENV=local
APP_API_KEY=dev-secret
EMBEDDING_PROVIDER=hash
CHROMA_PATH=data/chroma
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/enterprise_ai
TRACE_LOG_PATH=logs/traces.jsonl
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

`OPENAI_API_KEY` is optional. Without it, the app returns deterministic mock answers and can still
exercise upload, chunking, retrieval, tools, citations, and traces.

## Start Postgres

Tickets are persisted in Postgres. The easiest way to run it locally is the bundled Docker Compose
`db` service:

```bash
docker compose up -d db
```

This starts Postgres 16 on `localhost:5433` with database `enterprise_ai` (user `postgres`,
password `postgres`), matching the default `DATABASE_URL` above. The `tickets` table is created
automatically on the first ticket write, so no manual migration step is needed.

Host port `5433` is used on purpose so the container does not clash with a Postgres instance you may
already run locally on the default `5432`. Inside Docker Compose the API talks to the database over
the internal network at `db:5432`, so only the published host port differs.

If you prefer your own Postgres instance, point `DATABASE_URL` at it instead.

## Choose Embeddings

Fastest local bootstrap:

```bash
EMBEDDING_PROVIDER=hash
```

Real free local embeddings:

```bash
uv sync --extra dev --extra local-embeddings
```

Then edit `.env`:

```bash
EMBEDDING_PROVIDER=local
LOCAL_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
```

The first local embedding run downloads the model from Hugging Face. If you switch embedding
providers or models, clear `data/chroma` and seed again because vector dimensions may differ.

OpenAI embeddings:

```bash
OPENAI_API_KEY=sk-...
EMBEDDING_PROVIDER=openai
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

## Seed Knowledge Base

```bash
make seed
```

This indexes every Markdown, PDF and DOCX file under `docs/seed/`.

Expected output should show multiple documents and chunks, for example:

```json
{
  "documents_indexed": 7,
  "chunks_indexed": 38
}
```

## Run The API

```bash
make dev
```

Open:

- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

## Test Requests

Health:

```bash
curl http://localhost:8000/health
```

Chat:

```bash
curl -X POST http://localhost:8000/v1/chat \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"local-demo","message":"What approvals are needed for production data access?"}'
```

Upload:

```bash
curl -X POST http://localhost:8000/v1/documents/upload \
  -H "Authorization: Bearer dev-secret" \
  -F "file=@docs/demo_upload/acme_parental_leave_policy_2026.pdf" \
  -F "source=acme_parental_leave_policy_2026.pdf"
```

Streaming chat:

```bash
curl -N -X POST http://localhost:8000/v1/chat/stream \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"local-demo","message":"Create a high priority ticket for a failed import."}'
```

List tickets (persisted in Postgres through the SQLModel ORM):

```bash
curl http://localhost:8000/v1/tickets \
  -H "Authorization: Bearer dev-secret"
```

## Run Quality Checks

```bash
make lint
make test
```

Run evals after the API is running:

```bash
make eval
```

## Run With Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

The backend is available at http://localhost:8000.

## Local Data Locations

- Vector store: `data/chroma`
- Ticket database: Postgres (`enterprise_ai` database, `tickets` table)
- Trace log: `logs/traces.jsonl`

Reset local state:

```bash
rm -rf data/chroma logs/traces.jsonl
docker compose down -v db   # drops the Postgres volume, wiping tickets
docker compose up -d db
make seed
```

## Common Issues

If `app` cannot be imported, run commands from the backend directory and use the Makefile targets.

If retrieval returns poor results after changing embedding provider, clear `data/chroma` and seed
again.

If FastEmbed model download is slow or rate-limited, set a Hugging Face token in your shell:

```bash
export HF_TOKEN=...
```

If the frontend gets `401`, make sure the frontend API key matches `APP_API_KEY` in backend `.env`.

