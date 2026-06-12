# System Design

## Request Flow

1. Client calls `/v1/chat` or `/v1/chat/stream`.
2. `require_api_key` validates the bearer token.
3. `AgentRunner` starts a LangGraph run.
4. Router classifies the request as `rag`, `database`, or `ticket`.
5. Retriever searches Chroma for relevant document chunks.
6. Tool caller runs search-docs metadata and optional business tools.
7. Answer generator creates the final response.
8. Trace metadata is appended to `logs/traces.jsonl`.

## Storage

- Chroma persistent data: `data/chroma`
- Ticket SQLite database: `data/tickets.db`
- Trace logs: `logs/traces.jsonl`

## Production Upgrades

- Replace bearer token auth with OAuth/JWT.
- Move Chroma to a managed vector database such as Pinecone, Weaviate, or Qdrant.
- Replace fake database with Postgres or warehouse queries.
- Add background ingestion with Celery, Temporal, or a cloud queue.
- Add tracing with OpenTelemetry, LangSmith, or cloud-native logs.
- Add eval gates in CI before prompt or retrieval changes are merged.

