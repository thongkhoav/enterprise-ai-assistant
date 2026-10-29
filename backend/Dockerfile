FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:0.11.16 /uv /uvx /bin/

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-editable --extra local-embeddings

# Bake the embedding model into the image so containers start without a download.
ARG LOCAL_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
ENV FASTEMBED_CACHE_PATH=/opt/fastembed
RUN uv run python -c "from fastembed import TextEmbedding; TextEmbedding('${LOCAL_EMBEDDING_MODEL}')"

COPY app ./app
COPY docs ./docs
COPY evals ./evals
COPY scripts ./scripts

RUN mkdir -p data logs

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
