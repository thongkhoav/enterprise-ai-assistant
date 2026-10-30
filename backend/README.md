# Enterprise AI Assistant API

FastAPI skeleton for an enterprise AI assistant with:

- Bearer-token auth
- Streaming chat endpoint
- PDF/DOCX/TXT/MD upload
- Chunking, embeddings, and Chroma vector search
- RAG answers with citations
- LangGraph agent flow: router -> retriever -> tool caller -> answer generator
- Tools: search docs, query a fake database, create a ticket
- JSONL trace logs with estimated latency/cost fields
- Eval runner and sample eval set
- Docker Compose and GitHub Actions

## Quick Start

Use Python 3.11 or newer and `uv`.

Detailed guides:

- [Local setup](docs/LOCAL_SETUP.md)
- [Production setup](docs/PRODUCTION_SETUP.md)

```bash
brew install uv
```

```bash
cd backend
uv sync --extra dev
cp .env.example .env
```

Start Postgres (used for tickets). The bundled Compose `db` service runs it on host port `5433`,
matching the default `DATABASE_URL` in `.env.example`:

```bash
docker compose up -d db
```

The app creates its tables on startup, so Postgres must be reachable before you run `make dev`.
Host port `5433` avoids clashing with a Postgres instance you may already run locally on `5432`.

Set `OPENAI_API_KEY` in `.env` when you want real LLM and embedding calls.
Without it, the app still runs with deterministic local embeddings and mock answers (tickets still
require Postgres).

```bash
make dev
```

Open:

- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

## Seed Sample Knowledge

In another terminal:

```bash
make seed
```

This indexes every Markdown, PDF and DOCX file under `docs/seed/`.

Or upload your own document:

```bash
curl -X POST http://localhost:8000/v1/documents/upload \
  -H "Authorization: Bearer dev-secret" \
  -F "file=@docs/seed/acme_enterprise_support_policy.md" \
  -F "source=acme_enterprise_support_policy.md"
```

## Chat

JSON response:

```bash
curl -X POST http://localhost:8000/v1/chat \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"demo","message":"What is the refund SLA policy?"}'
```

Streaming response:

```bash
curl -N -X POST http://localhost:8000/v1/chat/stream \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"demo","message":"Create a high priority ticket for a failed enterprise import"}'
```

## Evals

Start the API first, then run:

```bash
make eval
```

The eval script checks route selection and keyword presence. This is intentionally simple so you can
extend it into real retrieval metrics, LLM-as-judge, and regression checks.

## Embeddings

The default `.env.example` uses:

```bash
EMBEDDING_PROVIDER=hash
```

This is free and deterministic, useful for bootstrapping without downloading a model.

For a real free local embedding model, install the optional extra:

```bash
uv sync --extra dev --extra local-embeddings
```

Then set:

```bash
EMBEDDING_PROVIDER=local
LOCAL_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
```

`BAAI/bge-small-en-v1.5` runs locally through FastEmbed, so it does not call OpenAI.
The first run downloads the model. If you switch embedding providers/models after indexing docs,
clear `data/chroma` and run `make seed` again because vector dimensions may differ.

## Docker

This starts both Postgres (`db`) and the API together; the API waits for Postgres to be healthy
before booting:

```bash
cp .env.example .env
docker compose up --build
```

## Learning Path Inside This Project

1. Run the mock system without `OPENAI_API_KEY`.
2. Run `make seed`, upload extra documents if needed, and call `/v1/chat`.
3. Read `app/agents/graph.py` to understand the LangGraph flow.
4. Read `app/services/rag.py` and replace the mock behavior with real prompts.
5. Add a real database tool next to `app/db/fake_database.py`.
6. Improve `evals/questions.jsonl` with 50 real business questions.
7. Add production observability: LangSmith, OpenTelemetry, or your cloud logging stack.
