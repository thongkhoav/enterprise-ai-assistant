import asyncio
import logging
from collections.abc import AsyncIterator
from time import perf_counter
from typing import Any
from uuid import uuid4

from langgraph.graph import END, StateGraph
from openai import APIError

from app.agents.router import classify_route
from app.agents.state import AgentState
from app.agents.tools import (
    create_ticket_tool,
    format_ticket_confirmation,
    query_database_tool,
    search_docs_tool,
)
from app.core.config import Settings
from app.db.tickets import TicketStore
from app.schemas.chat import ChatRequest
from app.services.rag import NO_ANSWER, RAGService, cited_numbers, is_no_answer
from app.telemetry.tracing import write_trace

SNIPPET_CHARS = 900
SUGGEST_TIMEOUT_S = 8

logger = logging.getLogger(__name__)


class AgentRunner:
    """Routes a question, gathers evidence with LangGraph, then streams the answer.

    The graph (router -> retriever -> tool_caller) decides what evidence the answer needs.
    Answer generation runs outside the graph so tokens can be streamed to the client as the
    model produces them.
    """

    def __init__(self, settings: Settings, rag: RAGService, ticket_store: TicketStore) -> None:
        self.settings = settings
        self.rag = rag
        self.ticket_store = ticket_store
        self.graph = self._build_graph()

    async def run(self, request: ChatRequest, conversation_id: str) -> dict[str, Any]:
        result: dict[str, Any] = {}
        async for event in self.stream(request, conversation_id):
            if event["type"] == "done":
                result = event
            elif event["type"] == "suggestions":
                result["suggestions"] = event["questions"]
        result.pop("type", None)
        return result

    async def stream(
        self, request: ChatRequest, conversation_id: str
    ) -> AsyncIterator[dict[str, Any]]:
        """Yield {"type": "token", "text"} events, one {"type": "done", ...} result, then
        {"type": "suggestions", "questions"} once the follow-up questions are ready."""
        started = perf_counter()
        trace_id = str(uuid4())
        initial: AgentState = {
            "conversation_id": conversation_id,
            "question": request.message,
            "trace_id": trace_id,
            "documents": [],
            "tool_results": [],
        }
        state = await self.graph.ainvoke(initial)
        route = state.get("route", "rag")
        documents = state.get("documents", [])
        tool_results = state.get("tool_results", [])

        answer_mode = self.rag.answer_mode
        fixed_answer = self._fixed_answer(route, documents, tool_results)
        if fixed_answer is not None:
            answer = fixed_answer
            yield {"type": "token", "text": answer}
        else:
            parts: list[str] = []
            try:
                async for delta in self.rag.stream_answer(
                    request.message, documents, tool_results
                ):
                    parts.append(delta)
                    yield {"type": "token", "text": delta}
            except APIError:
                # A bad key, rate limit or outage should not break the chat. Before any
                # token has streamed, fall back to the extractive answer from the sources.
                if parts:
                    raise
                logger.exception("Model call failed; answering from the sources instead")
                answer_mode = "fallback"
                async for delta in self.rag.stream_extractive(
                    request.message, documents, tool_results
                ):
                    parts.append(delta)
                    yield {"type": "token", "text": delta}
            answer = "".join(parts).strip()

        if is_no_answer(answer):
            route = "no_answer"
        citations = self._citations(route, documents, answer)
        latency_ms = round((perf_counter() - started) * 1000)

        write_trace(
            self.settings,
            {
                "trace_id": trace_id,
                "conversation_id": conversation_id,
                "route": route,
                "question": request.message,
                "answer_chars": len(answer),
                "tool_count": len(tool_results),
                "citation_count": len(citations),
                "latency_ms": latency_ms,
                "estimated_tokens": _estimate_tokens(request.message + answer),
                "estimated_cost_usd": _estimate_cost(
                    request.message + answer,
                    self.settings.rough_cost_per_1k_tokens_usd,
                ),
            },
        )

        yield {
            "type": "done",
            "conversation_id": conversation_id,
            "answer": answer,
            "route": route,
            "citations": citations,
            "tool_results": tool_results,
            "trace_id": trace_id,
            "latency_ms": latency_ms,
            "answer_mode": answer_mode,
        }

        # Follow-ups come after "done" so they never hold up the answer itself.
        yield {
            "type": "suggestions",
            "questions": await self._suggestions(
                request.message, answer, route, documents, tool_results
            ),
        }

    async def _suggestions(
        self,
        question: str,
        answer: str,
        route: str,
        documents: list[dict],
        tool_results: list[dict],
    ) -> list[str]:
        if route in ("ticket", "error"):
            return []
        evidence = [item for item in tool_results if item.get("name") != "search_docs"]
        try:
            return await asyncio.wait_for(
                self.rag.suggest_follow_ups(question, answer, documents, evidence),
                timeout=SUGGEST_TIMEOUT_S,
            )
        except Exception:  # suggestions are optional; the answer already went out
            logger.warning("Follow-up suggestions failed", exc_info=True)
            return []

    def _build_graph(self):
        builder = StateGraph(AgentState)
        builder.add_node("router", self._router)
        builder.add_node("retriever", self._retriever)
        builder.add_node("tool_caller", self._tool_caller)

        builder.set_entry_point("router")
        builder.add_edge("router", "retriever")
        builder.add_edge("retriever", "tool_caller")
        builder.add_edge("tool_caller", END)
        return builder.compile()

    async def _router(self, state: AgentState) -> AgentState:
        return {**state, "route": classify_route(state["question"])}

    async def _retriever(self, state: AgentState) -> AgentState:
        documents = await self.rag.retrieve(state["question"])
        return {**state, "documents": documents}

    async def _tool_caller(self, state: AgentState) -> AgentState:
        results = [{"name": "search_docs", "result": await search_docs_tool(state["documents"])}]

        if state.get("route") == "database":
            results.append(
                {
                    "name": "query_fake_database",
                    "result": await query_database_tool(state["question"]),
                }
            )

        if state.get("route") == "ticket":
            results.append(
                {
                    "name": "create_ticket",
                    "result": await create_ticket_tool(state["question"], self.ticket_store),
                }
            )

        return {**state, "tool_results": results}

    def _fixed_answer(
        self, route: str, documents: list[dict], tool_results: list[dict]
    ) -> str | None:
        """Answers that need no model call: ticket confirmations and "I don't know"."""
        if route == "ticket":
            ticket = self._tool_result(tool_results, "create_ticket")
            if ticket:
                return format_ticket_confirmation(ticket)
        if route == "rag" and not documents:
            return NO_ANSWER
        return None

    @staticmethod
    def _tool_result(tool_results: list[dict], name: str) -> dict | None:
        for item in tool_results:
            if item.get("name") == name:
                return item.get("result")
        return None

    def _citations(self, route: str, documents: list[dict], answer: str) -> list[dict]:
        """Sources backing the answer: the ones it cites, else every retrieved chunk for rag."""
        if route == "no_answer":
            return []

        cited = cited_numbers(answer)
        if cited:
            used = [doc for doc in documents if doc["n"] in cited]
        else:
            used = documents if route == "rag" else []
        citations = []
        for doc in used:
            metadata = doc.get("metadata", {})
            citations.append(
                {
                    "n": doc["n"],
                    "source": metadata.get("source", "unknown"),
                    "document_id": metadata.get("document_id"),
                    "chunk_id": metadata.get("chunk_id", "unknown"),
                    "page": metadata.get("page"),
                    "score": doc.get("score"),
                    "text": (doc.get("text") or "")[:SNIPPET_CHARS],
                }
            )
        return citations


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def _estimate_cost(text: str, cost_per_1k_tokens: float) -> float:
    return round((_estimate_tokens(text) / 1000.0) * cost_per_1k_tokens, 6)
