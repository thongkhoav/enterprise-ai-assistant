# Enterprise AI Assistant

Monorepo for an enterprise AI assistant portfolio project.

## Structure

- `backend/`: FastAPI + LangGraph + Chroma RAG API
- `frontend/`: Vite + React + TypeScript UI for upload, streaming chat, citations, and tools

## Run Backend

Use Python 3.11 or newer.

```bash
cd /Users/rio/Documents/coding/enterprise-ai-assistant/backend
uv sync --extra dev
cp .env.example .env
make seed
make dev
```

Backend URLs:

- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

## Run Frontend

Use Node.js 20 or newer.

```bash
cd /Users/rio/Documents/coding/enterprise-ai-assistant/frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173.

Default frontend settings:

- API base URL: `http://localhost:8000`
- API key: `dev-secret`

## Free Local Embeddings

The backend defaults to `EMBEDDING_PROVIDER=hash` so the demo starts without model downloads.
For a real free embedding model, run:

```bash
cd /Users/rio/Documents/coding/enterprise-ai-assistant/backend
uv sync --extra dev --extra local-embeddings
```

Then edit `backend/.env`:

```bash
EMBEDDING_PROVIDER=local
LOCAL_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
```

## First Demo Flow

1. Start backend.
2. Start frontend.
3. Run `make seed` in `backend/`, or upload `backend/docs/sample_policy.md`.
4. Ask: `What is the refund SLA policy?`
5. Ask: `What is current MRR revenue?`
6. Ask: `Create a high priority ticket for a failed enterprise import.`

More seed questions to try:

- `What approvals are needed for production data access?`
- `What should be included in a failed import ticket?`
- `How should customer-facing incident updates be written?`
- `When does a renewal become high risk?`
- `What is the difference between a credit and a refund?`

## Docker Compose

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

Then open:

- Frontend: http://localhost:5173
- Backend: http://localhost:8000/docs

## What To Build Next

- Add real login and user sessions.
- Replace fake database with Postgres.
- Add a real ticketing integration.
- Add LangSmith or OpenTelemetry tracing.
- Expand `backend/evals/questions.jsonl` to 50+ business cases.
