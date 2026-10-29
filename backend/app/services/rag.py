import asyncio
import re
from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from app.core.config import Settings
from app.services.vector_store import VectorStore

NO_ANSWER = "I don't know. The indexed documents don't cover that question."

# gpt-4.1-mini misread banded rules (e.g. which service-credit tier 98.5% uptime falls in)
# in 5 of 6 runs on the seed contract; gpt-4.1 got all 6 right at a few tenths of a cent more.
DEFAULT_MODEL = "gpt-4.1"

# Minimum cosine similarity for a chunk to count as evidence, per embedding provider.
# bge-small scores unrelated text around 0.45-0.55; hash vectors only overlap on shared words.
# The extractive answer quotes whatever clears the bar, so offline mode needs a strict one.
DEFAULT_MIN_SCORE = {"local": 0.62, "openai": 0.35, "hash": 0.12}
# With a model, the bar only has to reject clearly off-topic questions: the model reads the
# near misses and replies NO_ANSWER itself when they do not answer the question. On the seed
# docs, "hotel limit in London?" (answered on handbook p.3) scores 0.60 while "parental
# leave policy?" (not covered) scores 0.59, so no single strict bar separates them.
LLM_MIN_SCORE = {"local": 0.55, "openai": 0.3, "hash": 0.1}

SYSTEM_PROMPT = f"""You answer questions using only the numbered sources below.

Rules:
- Put the source number in square brackets at the end of each sentence it supports,
  like "... within 24 business hours [1]." Never collect all citations at the very end.
- Live data from tools is labelled [data]; cite it the same way and report the values
  as given. Do not invent formulas or derived metrics the data does not state.
- Never use outside knowledge. If the sources do not answer the question, reply exactly:
  {NO_ANSWER}
- Be concise: answer the question directly in two to four sentences or a few bullet
  points, with no closing summary or commentary. Plain text, no headings.

Example of the citation style:
  Invoices are due within 30 days [1]. Late invoices pause API access after 14 days [3].
Example with live data that has no "churn rate" field:
  The data does not report a churn rate. It shows 37 of 12,840 customers flagged as
  churn risk [data]."""

_CITATION_PATTERN = re.compile(r"\[(\d+)\]")
_STOPWORDS = {
    "what", "which", "when", "where", "does", "should", "would", "about", "with", "from",
    "that", "this", "there", "their", "have", "your", "into", "the", "and", "for", "are",
    "how", "who", "why", "can", "our", "any", "between", "difference",
}  # fmt: skip


class RAGService:
    def __init__(self, settings: Settings, vector_store: VectorStore) -> None:
        self.settings = settings
        self.vector_store = vector_store
        self._client = (
            AsyncOpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
            if settings.openai_api_key
            else None
        )
        defaults = LLM_MIN_SCORE if self._client else DEFAULT_MIN_SCORE
        self.min_score = (
            settings.rag_min_score
            if settings.rag_min_score is not None
            else defaults.get(vector_store.embeddings.provider, 0.3)
        )

    @property
    def answer_mode(self) -> str:
        return "llm" if self._client else "extractive"

    async def retrieve(self, question: str) -> list[dict]:
        """Return relevant chunks for a question, numbered 1..n for citation.

        Chunks below `min_score` are dropped, so an off-topic question yields an empty list and
        the agent answers "I don't know" instead of grounding on unrelated text.
        """
        hits = await self.vector_store.search(question, top_k=self.settings.rag_top_k)
        relevant = [hit for hit in hits if (hit.get("score") or 0) >= self.min_score]
        return [{**hit, "n": index} for index, hit in enumerate(relevant, start=1)]

    async def stream_answer(
        self, question: str, docs: list[dict], tool_results: list[dict]
    ) -> AsyncIterator[str]:
        """Stream the answer as text deltas.

        Uses the configured OpenAI-compatible model when a key is set; otherwise streams an
        extractive answer built from the best-matching source sentences so the demo runs offline.
        """
        if not self._client:
            async for delta in self.stream_extractive(question, docs, tool_results):
                yield delta
            return

        stream = await self._client.chat.completions.create(
            model=self.settings.openai_model or DEFAULT_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Sources:\n{self._format_context(docs, tool_results)}\n\n"
                    f"Question: {question}",
                },
            ],
            temperature=0.1,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def stream_extractive(
        self, question: str, docs: list[dict], tool_results: list[dict]
    ) -> AsyncIterator[str]:
        """Stream the offline answer, also used when the model call fails."""
        async for delta in _typewriter(self._extractive_answer(question, docs, tool_results)):
            yield delta

    def _format_context(self, docs: list[dict], tool_results: list[dict]) -> str:
        """Format numbered sources and tool results into the prompt context."""
        doc_lines = []
        for doc in docs:
            metadata = doc.get("metadata", {})
            page = f", page {metadata['page']}" if metadata.get("page") else ""
            doc_lines.append(
                f"[{doc['n']}] ({metadata.get('source', 'unknown')}{page})\n{doc.get('text', '')}"
            )

        tool_lines = [
            f"[data] {item['name']}: {item['result']}"
            for item in tool_results
            if item["name"] != "search_docs"
        ]
        return "\n\n".join([*doc_lines, *tool_lines]) or "No sources found."

    def _extractive_answer(self, question: str, docs: list[dict], tool_results: list[dict]) -> str:
        """Offline answer: the source sentences that share the most words with the question."""
        rows = next(
            (item["result"] for item in tool_results if item["name"] == "query_fake_database"),
            None,
        )
        if rows:
            values = ", ".join(f"{key}: {value}" for key, value in rows["rows"].items())
            return f"Live {rows['table']} data: {values} [data]."

        terms = _content_words(question)
        scored: list[tuple[int, int, int, str]] = []
        for doc in docs[:3]:
            for position, sentence in enumerate(_sentences(doc.get("text", ""))):
                overlap = len(terms & _content_words(sentence))
                if overlap:
                    scored.append((overlap, -position, doc["n"], sentence))

        if not scored:
            return NO_ANSWER

        ranked = sorted(scored, reverse=True)
        floor = max(2, ranked[0][0] * 0.6)
        picked: list[tuple[int, str]] = []
        for overlap, _, n, sentence in ranked:
            if overlap < floor and picked:
                break
            if all(sentence != seen for _, seen in picked):
                picked.append((n, sentence))
            if len(picked) == 3:
                break
        return " ".join(f"{sentence} [{n}]" for n, sentence in picked)


def is_no_answer(answer: str) -> bool:
    return answer.strip().lower().replace("’", "'").startswith("i don't know")


def cited_numbers(answer: str) -> set[int]:
    return {int(match) for match in _CITATION_PATTERN.findall(answer)}


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|\s+(?=#+\s)|\s+(?=- )", text)
    return [part.strip(" -#") for part in parts if len(part.strip()) > 25]


def _content_words(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return {word for word in words if len(word) > 2 and word not in _STOPWORDS}


async def _typewriter(text: str) -> AsyncIterator[str]:
    for word in text.split(" "):
        yield word + " "
        await asyncio.sleep(0.012)
