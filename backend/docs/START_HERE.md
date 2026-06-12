# Start Here

This project is meant to help you learn the job-description skills in a practical order.

## Week 1: FastAPI Backend

- Understand `app/main.py`, routes, dependencies, and auth.
- Add one new endpoint, for example `GET /v1/tickets`.
- Write tests for the endpoint.

## Week 2: RAG Basics

- Read `app/services/document_loader.py`, `chunking.py`, `embeddings.py`, and `vector_store.py`.
- Upload different file types.
- Tune `CHUNK_SIZE`, `CHUNK_OVERLAP`, and `RAG_TOP_K`.
- Try `EMBEDDING_PROVIDER=local` with `LOCAL_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5`.
- Clear `data/chroma` and seed again when changing embedding model/provider.

## Week 3: Agent AI

- Read `app/agents/graph.py`.
- Add a new route, for example `analytics`.
- Add one more tool and call it from `tool_caller`.

## Week 4: Evaluation

- Expand `evals/questions.jsonl` to 50 business questions.
- Track route accuracy, citation presence, and answer keyword matches.
- Add a retrieval quality metric: expected source in top 3.

## Week 5: Production Readiness

- Add a real database.
- Add proper user authentication.
- Add OpenTelemetry or LangSmith.
- Deploy with Docker Compose or Kubernetes.
