from types import SimpleNamespace

import httpx
from openai import APIConnectionError

from app.agents.graph import AgentRunner
from app.core.config import Settings
from app.schemas.chat import ChatRequest
from app.services.rag import NO_ANSWER, RAGService, cited_numbers, is_no_answer

POLICY = (
    "Refund requests must be acknowledged within 24 business hours. "
    "Standard refunds are processed within 5 business days."
)


class FakeVectorStore:
    def __init__(self, hits: list[dict]) -> None:
        self.hits = hits
        self.embeddings = SimpleNamespace(provider="local")

    async def search(self, query: str, *, top_k: int) -> list[dict]:
        return self.hits[:top_k]


def _settings(tmp_path) -> Settings:
    return Settings(openai_api_key=None, trace_log_path=tmp_path / "traces.jsonl")


def _hit(text: str, score: float, source: str = "policy.md") -> dict:
    return {"text": text, "score": score, "metadata": {"source": source, "chunk_id": source}}


async def test_retrieve_drops_chunks_below_min_score(tmp_path) -> None:
    store = FakeVectorStore([_hit(POLICY, 0.81), _hit("Unrelated text.", 0.40, "other.md")])
    rag = RAGService(_settings(tmp_path), store)

    docs = await rag.retrieve("refund")

    assert [doc["metadata"]["source"] for doc in docs] == ["policy.md"]
    assert docs[0]["n"] == 1


async def test_agent_says_i_dont_know_when_nothing_is_relevant(tmp_path) -> None:
    store = FakeVectorStore([_hit(POLICY, 0.41)])
    settings = _settings(tmp_path)
    agent = AgentRunner(settings, RAGService(settings, store), ticket_store=None)

    result = await agent.run(ChatRequest(message="What is the capital of France?"), "c-1")

    assert result["answer"] == NO_ANSWER
    assert result["route"] == "no_answer"
    assert result["citations"] == []
    # Offline mode has no model to write follow-ups, so it offers none.
    assert result["suggestions"] == []


async def test_agent_answer_cites_source_passage(tmp_path) -> None:
    store = FakeVectorStore([_hit(POLICY, 0.85)])
    settings = _settings(tmp_path)
    agent = AgentRunner(settings, RAGService(settings, store), ticket_store=None)

    request = ChatRequest(message="How fast are refund requests acknowledged?")
    result = await agent.run(request, "c-1")

    assert "24 business hours" in result["answer"]
    assert "[1]" in result["answer"]
    assert result["citations"][0]["n"] == 1
    assert result["citations"][0]["text"] == POLICY
    assert result["answer_mode"] == "extractive"


async def test_agent_falls_back_to_sources_when_the_model_call_fails(tmp_path) -> None:
    store = FakeVectorStore([_hit(POLICY, 0.85)])
    settings = Settings(openai_api_key="sk-invalid", trace_log_path=tmp_path / "traces.jsonl")
    rag = RAGService(settings, store)

    async def failing_create(**_: object) -> None:
        raise APIConnectionError(request=httpx.Request("POST", "https://api.openai.com"))

    rag._client.chat.completions.create = failing_create
    agent = AgentRunner(settings, rag, ticket_store=None)

    request = ChatRequest(message="How fast are refund requests acknowledged?")
    result = await agent.run(request, "c-1")

    assert "24 business hours" in result["answer"]
    assert result["answer_mode"] == "fallback"
    assert result["citations"][0]["n"] == 1


def test_answer_helpers() -> None:
    assert is_no_answer("I don’t know. The documents do not say.")
    assert not is_no_answer("Refunds take 5 days [1].")
    assert cited_numbers("A [1]. B [2][3]. C [data].") == {1, 2, 3}
