from typing import Any, TypedDict


class AgentState(TypedDict, total=False):
    session_id: str
    question: str
    route: str
    documents: list[dict[str, Any]]
    tool_results: list[dict[str, Any]]
    answer: str
    trace_id: str

