# Enterprise AI Assistant API

FastAPI backend for the company knowledge assistant:

- JWT sign-in with admin and member roles (admins manage documents and the support inbox)
- PDF, DOCX, Markdown and text upload, chunked and embedded into Chroma
- RAG answers with numbered citations, streamed token by token, and "I don't know" when no source
  clears the relevance threshold
- Follow-up suggestions, support requests ("Talk to a person", "Request this document") and admin
  replies posted back into the employee's conversation
- LangGraph agent flow: router -> retriever -> tool caller -> answer generator
- Tools: search docs, query company metrics, create a ticket
- Conversations, tickets and support requests in Postgres (SQLModel)
- JSONL trace logs with latency and estimated cost
- Eval runner with 65 sample questions

Guides:

- [Local setup](docs/LOCAL_SETUP.md)
- [Production setup](docs/PRODUCTION_SETUP.md)
- [System design](docs/SYSTEM_DESIGN.md)

## Quick Start

Use Python 3.11 or newer and [`uv`](https://docs.astral.sh/uv/).

```bash
cd backend
uv sync --extra dev --extra local-embeddings
cp .env.example .env
docker compose up -d db
make seed
make dev
```

Postgres runs on host port `5433`, matching the default `DATABASE_URL`. The app creates its
tables on startup, so start Postgres before `make dev`.

Set `OPENAI_API_KEY` in `.env` for generated answers. Without it the app still runs in an offline
extractive mode that quotes the best-matching source sentences.

Open:

- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

## Call the API

Every route except `/health` needs a JWT. Register (or log in with `/v1/auth/login`) and keep
the token:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@acme.example","password":"choose-a-password","full_name":"Your Name"}' \
  | python3 -c 'import json, sys; print(json.load(sys.stdin)["access_token"])')
```

Accounts whose email is listed in `ADMIN_EMAILS` register as admins. Only admins can upload or
delete documents:

```bash
curl -X POST http://localhost:8000/v1/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@docs/demo_upload/acme_parental_leave_policy_2026.pdf" \
  -F "source=acme_parental_leave_policy_2026.pdf"
```

Chat (JSON):

```bash
curl -X POST http://localhost:8000/v1/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"How many PTO days carry over to next year?"}'
```

Chat (server-sent events):

```bash
curl -N -X POST http://localhost:8000/v1/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Create a high priority ticket: my laptop screen is cracked."}'
```

Pass the returned `conversation_id` to continue the same conversation.

## Seed Knowledge

`make seed` indexes every Markdown, PDF and DOCX file under `docs/seed/`: seven documents for the
fictional company Acme (handbook, benefits guide, IT help desk guide, onboarding, access control,
incident response and a customer contract). `docs/demo_upload/` holds a parental leave policy
that is deliberately left out, so you can watch "I don't know" turn into a cited answer.

## Embeddings

`.env.example` uses `EMBEDDING_PROVIDER=local`, which runs `BAAI/bge-small-en-v1.5` on CPU through
FastEmbed (installed by the `local-embeddings` extra; the first run downloads the model). `openai`
uses `OPENAI_EMBEDDING_MODEL`. `hash` needs no download but is not semantic, so keep it for tests.

Each provider gets its own Chroma collection; re-run `make seed` after switching.

## Quality Checks

```bash
make lint
make test
```

With the API running:

```bash
make eval
```

The eval replays `evals/questions.jsonl` and reports route and answer-keyword accuracy.

## Docker

Starts Postgres (`db`) and the API together; the API waits for Postgres to be healthy:

```bash
cp .env.example .env
docker compose up --build
```
