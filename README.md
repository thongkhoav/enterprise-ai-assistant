# Enterprise AI Assistant

Monorepo for an enterprise AI assistant portfolio project: a RAG chatbot that answers from your
documents and shows the passage (and PDF page) each answer comes from.

## What It Does

- Upload PDF, DOCX, Markdown or text; documents are chunked, embedded with a free local model
  (`BAAI/bge-small-en-v1.5` via fastembed) and stored in Chroma.
- Answers stream token by token and cite sources as `[1]`, `[2]`. Clicking a citation opens the
  source passage with the quoted sentence highlighted.
- When no chunk clears the relevance threshold (`RAG_MIN_SCORE`), the assistant replies
  "I don't know" instead of guessing.
- A LangGraph router sends metric questions to a database tool and "create a ticket" requests to a
  ticket tool; a trace panel shows route, latency, retrieval scores and tool output.
- "Try the demo" on the sign-in page creates a private guest session, so visitors need no account.

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

## Models

Embeddings: `.env.example` uses `EMBEDDING_PROVIDER=local` (free, runs on CPU). Install it with:

```bash
cd /Users/rio/Documents/coding/enterprise-ai-assistant/backend
uv sync --extra dev --extra local-embeddings
```

`EMBEDDING_PROVIDER=hash` needs no download but is not semantic; use it only for tests. Each
provider gets its own Chroma collection, so re-run `make seed` after switching.

Answers: set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, default `gpt-4.1-mini`) for
generated answers. Any OpenAI-compatible API works through `OPENAI_BASE_URL` (OpenRouter, Groq,
Together, a local server). Without a key the app still runs in an offline extractive mode that
quotes the best-matching source sentences.

Relevance: `RAG_MIN_SCORE` overrides the "I don't know" threshold (default 0.62 for bge-small).
`SEED_ON_STARTUP=true` indexes the bundled sample docs when the index is empty, which keeps a fresh
deploy from starting with no documents.

## First Demo Flow

1. Start Postgres (`docker compose up -d db` in `backend/`), the backend and the frontend.
2. Run `make seed` in `backend/`, or drop files onto the chat.
3. Click "Try the demo", then ask: `What is the refund SLA policy?` and click a `[1]` citation.
4. Ask something the docs do not cover: `What is our parental leave policy?` ("I don't know").
5. Ask: `What is current MRR revenue?` (database tool).
6. Ask: `Create a high priority ticket for a failed enterprise import.` (ticket tool).

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
