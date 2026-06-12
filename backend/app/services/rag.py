from openai import AsyncOpenAI

from app.core.config import Settings
from app.services.vector_store import VectorStore


class RAGService:
    def __init__(self, settings: Settings, vector_store: VectorStore) -> None:
        self.settings = settings
        self.vector_store = vector_store
        self._client = (
            AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
        )

    async def retrieve(self, question: str) -> list[dict]:
        return await self.vector_store.search(question, top_k=self.settings.rag_top_k)

    async def answer(self, question: str, docs: list[dict], tool_results: list[dict]) -> str:
        if not self._client:
            return self._mock_answer(question, docs, tool_results)

        context = self._format_context(docs, tool_results)
        response = await self._client.responses.create(
            model=self.settings.openai_model or "gpt-4.1-mini",
            input=[
                {
                    "role": "system",
                    "content": (
                        "You are an enterprise AI assistant. Answer using the supplied context. "
                        "Cite document evidence with [source#chunk_id]. If evidence is missing, "
                        "say what is missing and suggest the next operational step."
                    ),
                },
                {"role": "user", "content": f"Question: {question}\n\nContext:\n{context}"},
            ],
            temperature=0.2,
        )
        return response.output_text

    def _format_context(self, docs: list[dict], tool_results: list[dict]) -> str:
        doc_lines = []
        for index, doc in enumerate(docs, start=1):
            metadata = doc.get("metadata", {})
            source = metadata.get("source", "unknown")
            chunk_id = metadata.get("chunk_id", f"chunk-{index}")
            doc_lines.append(f"[{source}#{chunk_id}] {doc.get('text', '')}")

        tool_lines = [f"{item['name']}: {item['result']}" for item in tool_results]
        return "\n\n".join([*doc_lines, *tool_lines]) or "No context found."

    def _mock_answer(self, question: str, docs: list[dict], tool_results: list[dict]) -> str:
        citations = []
        for doc in docs[:3]:
            metadata = doc.get("metadata", {})
            citations.append(
                f"[{metadata.get('source', 'unknown')}#{metadata.get('chunk_id', 'chunk')}]"
            )

        tool_summary = "; ".join(f"{item['name']}={item['result']}" for item in tool_results)
        evidence = " ".join(citations) if citations else "no document citations yet"
        return (
            "Mock answer because OPENAI_API_KEY is not configured. "
            f"For the question '{question}', retrieved evidence: {evidence}. "
            f"Tool output: {tool_summary or 'none'}."
        )
