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

Answers: set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, default `gpt-4.1`) for
generated answers. Any OpenAI-compatible API works through `OPENAI_BASE_URL` (OpenRouter, Groq,
Together, a local server). Without a key the app still runs in an offline extractive mode that
quotes the best-matching source sentences.

Relevance: `RAG_MIN_SCORE` overrides the "I don't know" threshold (default 0.62 for bge-small).
`SEED_ON_STARTUP=true` indexes the bundled sample docs when the index is empty, which keeps a fresh
deploy from starting with no documents.

## Sample Data

`make seed` indexes 11 documents for a fictional SaaS company, Acme: a 5-page master service
agreement and a 5-page employee handbook (PDF, so answers cite page numbers), a pricing sheet
(DOCX), release notes and six support runbooks (Markdown). The database tool serves live-looking
metrics: revenue, customers, employees, SLA, uptime, NPS and sales pipeline.

`backend/docs/demo_upload/acme_security_whitepaper.pdf` is deliberately not seeded. Ask
`What is the RTO and RPO?` first ("I don't know"), drop the PDF onto the chat, then ask again.

The PDF and DOCX files are generated from `backend/scripts/build_seed_files.py`
(`uv run --with reportlab python scripts/build_seed_files.py`).

## First Demo Flow

1. Start Postgres (`docker compose up -d db` in `backend/`), the backend and the frontend.
2. Run `make seed` in `backend/`, or drop files onto the chat.
3. Click "Try the demo", then ask: `What service credit do we get if monthly uptime drops to 98.5%?`
   and click the `[1]` citation (contract PDF, page 3).
4. Ask something the docs do not cover: `What is our parental leave policy?` ("I don't know").
5. Ask: `What is our current MRR?` (database tool, shown as a Live data card).
6. Ask: `Create a high priority ticket for a failed enterprise import.` (ticket tool).

More questions to try:

- `What is the hotel limit in London?`
- `How much notice is needed to stop the subscription from renewing?`
- `Do we offer a discount for nonprofits?`
- `What uptime does the Strategic plan guarantee, and what is our current uptime?`
- `What approvals are needed for production data access?`
- `What is the difference between a credit and a refund?`

`uv run python scripts/run_eval.py` replays the 57 questions in `backend/evals/questions.jsonl`
against a running backend and reports route and answer-keyword accuracy.

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
