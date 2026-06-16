# Production Backend Setup Guide

This guide describes how to run the backend in a production-style environment. Treat it as a
deployment checklist for a real service, not a complete cloud-specific Terraform setup.

## Production Architecture

Recommended production components:

- FastAPI backend container
- Managed secrets store for API keys and auth secrets
- Persistent database for tickets and application state
- Managed vector database or persistent Chroma volume
- Object storage for uploaded documents
- Centralized logs, metrics, and traces
- Reverse proxy or API gateway with TLS
- CI/CD pipeline that runs lint, tests, build, and deploy

The current skeleton uses local Chroma for vectors and Postgres for tickets. Chroma still needs to
be replaced or backed by a persistent/managed service before handling real customer data; the
ticket store already speaks Postgres, so production mainly needs a managed/HA Postgres instance.

## Build The Backend Image

From the backend directory:

```bash
docker build -t enterprise-ai-assistant-backend:latest .
```

Run locally with production-like env:

```bash
docker run --rm \
  -p 8000:8000 \
  --env-file .env.production \
  enterprise-ai-assistant-backend:latest
```

## Required Environment Variables

Use a secrets manager rather than committing `.env.production`.

```bash
APP_ENV=production
APP_API_KEY=<strong-random-token>
OPENAI_API_KEY=<provider-key-if-using-openai>
OPENAI_MODEL=<model-name>
EMBEDDING_PROVIDER=<openai|local|auto>
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
LOCAL_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
CHROMA_PATH=/app/data/chroma
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>
TRACE_LOG_PATH=/app/logs/traces.jsonl
CORS_ORIGINS=https://your-frontend.example.com
```

For a real product, replace `APP_API_KEY` bearer auth with user authentication such as OAuth2/OIDC
or signed JWTs. Keep the bearer token only for internal demos or staging.

## Storage Choices

### Vector Store

For production, prefer a managed vector database:

- Pinecone
- Weaviate
- Qdrant Cloud
- pgvector on managed Postgres

Local Chroma is acceptable for local development and small staging demos, but it needs a persistent
volume and backup strategy in production.

### Ticket Store

The ticket store uses the SQLModel ORM (SQLAlchemy + Pydantic) over an async `asyncpg` engine,
configured through `DATABASE_URL`. Models live in `app/db/models.py`, the engine and session
dependency in `app/db/database.py`, and repository helpers in `app/db/tickets.py`. For production,
point `DATABASE_URL` at a managed/HA Postgres instance (RDS, Cloud SQL, Neon, Supabase, etc.) with
backups, TLS, and connection limits sized for the engine pool. Manage schema changes with a real
migration tool (Alembic) instead of the demo `create_all` bootstrap, which only creates missing
tables and never alters existing ones.

### Uploaded Documents

Do not keep production uploads only on container disk. Store originals in object storage such as S3,
GCS, or Azure Blob Storage. Store metadata in Postgres, and index only processed chunks in the
vector store.

## Embedding Strategy

OpenAI embeddings:

- Easier operationally
- Higher external API cost
- Requires provider key and outbound network access

Local embeddings with FastEmbed:

- No OpenAI embedding cost
- Requires CPU/memory capacity
- First startup may download model unless baked into the image or cached on a volume

For production local embeddings, pre-download or bake the model into the image, or mount a persistent
model cache. Avoid downloading model weights on every deployment.

## Health Checks

The API exposes:

```bash
GET /health
```

Container health check example:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 20s
  timeout: 5s
  retries: 5
```

For production, add deeper readiness checks before routing traffic:

- vector store reachable
- database reachable
- model provider configured
- write access to trace/log destination

## Observability

Current traces are written to:

```bash
logs/traces.jsonl
```

Production should send logs and traces to a central platform:

- OpenTelemetry collector
- Datadog
- Grafana Cloud
- CloudWatch
- Google Cloud Logging
- Azure Monitor
- LangSmith for LLM traces

Minimum metrics to track:

- request count and error rate
- latency p50/p95/p99
- token usage and estimated cost
- retrieval top-k latency
- empty citation rate
- tool call count and tool error rate
- document upload count and chunk count
- embedding latency and provider errors

## Security Checklist

- Replace demo bearer auth with real auth before production.
- Use HTTPS only.
- Keep all secrets in a secrets manager.
- Restrict CORS to approved frontend domains.
- Validate file size, extension, content type, and malware scanning for uploads.
- Redact logs before sending them to external systems.
- Do not log raw documents, API keys, user tokens, or payment data.
- Add rate limits per user/workspace.
- Add authorization checks around document collections and sessions.
- Encrypt database, object storage, and vector store data at rest.

## Scaling Notes

FastAPI can scale horizontally behind a load balancer. Keep state outside the container:

- vector DB for retrieval
- Postgres for tickets/session metadata
- object storage for source files
- external log/trace sink

For document ingestion, move large files and embedding work to a background queue:

- Temporal
- Celery/RQ
- cloud task queues
- Kafka or Pub/Sub for event-driven ingestion

The chat path should stay low-latency. The ingestion path can be asynchronous.

## CI/CD Checklist

Before deploy:

```bash
uv sync --extra dev --frozen
uv run ruff check .
uv run pytest
docker build -t enterprise-ai-assistant-backend:<sha> .
```

Recommended pipeline stages:

1. Dependency lock check
2. Lint
3. Unit tests
4. Docker build
5. Security scan
6. Push image
7. Deploy to staging
8. Smoke test `/health` and `/v1/chat`
9. Promote to production

## Production Smoke Test

After deployment:

```bash
curl https://api.example.com/health
```

Then test an authenticated chat request:

```bash
curl -X POST https://api.example.com/v1/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"prod-smoke","message":"What is the incident update policy?"}'
```

Confirm:

- response includes an answer
- citations are present after seeding/indexing
- `trace_id` is returned
- route is expected
- logs/traces are visible in the observability system

## Migration Path From Skeleton To Production

1. Replace bearer token auth with OIDC/JWT.
2. Point `DATABASE_URL` at managed/HA Postgres and adopt Alembic migrations.
3. Replace local Chroma with managed vector DB or persistent pgvector.
4. Move uploads to object storage.
5. Move ingestion to background jobs.
6. Add OpenTelemetry or LangSmith tracing.
7. Add real eval gates for retrieval quality and answer quality.
8. Add tenant/workspace authorization.
9. Add admin tools for reindexing and document deletion.
10. Add incident runbooks for provider outages and failed deployments.

