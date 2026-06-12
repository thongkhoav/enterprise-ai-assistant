.PHONY: install install-local-embeddings dev test lint format docker-up docker-down seed eval

install:
	uv sync --extra dev

install-local-embeddings:
	uv sync --extra dev --extra local-embeddings

dev:
	uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	uv run pytest

lint:
	uv run ruff check .

format:
	uv run ruff format .
	uv run ruff check . --fix

docker-up:
	docker compose up --build

docker-down:
	docker compose down

seed:
	uv run python -m scripts.seed_sample_docs

eval:
	uv run python -m scripts.run_eval
