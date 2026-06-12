from typing import Any
from uuid import uuid4

from langgraph.graph import END, StateGraph

from app.agents.state import AgentState
from app.agents.tools import create_ticket_tool, query_database_tool, search_docs_tool
from app.core.config import Settings
from app.db.tickets import TicketStore
from app.schemas.chat import ChatRequest
from app.services.rag import RAGService
from app.telemetry.tracing import write_trace


class AgentRunner:
    def __init__(self, settings: Settings, rag: RAGService, ticket_store: TicketStore) -> None:
        self.settings = settings
        self.rag = rag
        self.ticket_store = ticket_store
        self.graph = self._build_graph()

    async def run(self, request: ChatRequest) -> dict[str, Any]:
        trace_id = str(uuid4())
        initial: AgentState = {
            "session_id": request.session_id,
            "question": request.message,
            "trace_id": trace_id,
            "documents": [],
            "tool_results": [],
        }

        result = await self.graph.ainvoke(initial)
        citations = self._citations(result.get("documents", []))
        answer = result.get("answer", "")
        tool_results = result.get("tool_results", [])

        write_trace(
            self.settings,
            {
                "trace_id": trace_id,
                "session_id": request.session_id,
                "route": result.get("route", "rag"),
                "question": request.message,
                "answer_chars": len(answer),
                "tool_count": len(tool_results),
                "citation_count": len(citations),
                "estimated_tokens": _estimate_tokens(request.message + answer),
                "estimated_cost_usd": _estimate_cost(
                    request.message + answer,
                    self.settings.rough_cost_per_1k_tokens_usd,
                ),
            },
        )

        return {
            "session_id": request.session_id,
            "answer": answer,
            "route": result.get("route", "rag"),
            "citations": citations,
            "tool_results": tool_results,
            "trace_id": trace_id,
        }

    def _build_graph(self):
        builder = StateGraph(AgentState)
        builder.add_node("router", self._router)
        builder.add_node("retriever", self._retriever)
        builder.add_node("tool_caller", self._tool_caller)
        builder.add_node("answer_generator", self._answer_generator)

        builder.set_entry_point("router")
        builder.add_edge("router", "retriever")
        builder.add_edge("retriever", "tool_caller")
        builder.add_edge("tool_caller", "answer_generator")
        builder.add_edge("answer_generator", END)
        return builder.compile()

    async def _router(self, state: AgentState) -> AgentState:
        question = state["question"].lower()
        if self._is_ticket_creation_intent(question):
            route = "ticket"
        elif self._is_database_intent(question):
            route = "database"
        else:
            route = "rag"
        return {**state, "route": route}

    def _is_ticket_creation_intent(self, question: str) -> bool:
        action_words = ["create", "open", "file", "raise", "log"]
        ticket_words = ["ticket", "task", "issue", "bug", "incident"]
        return any(word in question for word in action_words) and any(
            word in question for word in ticket_words
        )

    def _is_database_intent(self, question: str) -> bool:
        database_words = ["database", "revenue", "mrr", "employee", "sla", "churn"]
        aggregate_words = ["how many", "count", "total", "show", "report", "query"]
        return any(word in question for word in database_words) or any(
            phrase in question for phrase in aggregate_words
        )

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

    async def _answer_generator(self, state: AgentState) -> AgentState:
        answer = await self.rag.answer(
            state["question"],
            state.get("documents", []),
            state.get("tool_results", []),
        )
        return {**state, "answer": answer}

    def _citations(self, documents: list[dict]) -> list[dict]:
        citations = []
        for doc in documents:
            metadata = doc.get("metadata", {})
            citations.append(
                {
                    "source": metadata.get("source", "unknown"),
                    "chunk_id": metadata.get("chunk_id", "unknown"),
                    "page": metadata.get("page"),
                    "score": doc.get("score"),
                }
            )
        return citations


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def _estimate_cost(text: str, cost_per_1k_tokens: float) -> float:
    return round((_estimate_tokens(text) / 1000.0) * cost_per_1k_tokens, 6)
