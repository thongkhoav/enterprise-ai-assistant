import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.agents.graph import AgentRunner
from app.api.deps import get_agent_runner, require_api_key
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"], dependencies=[Depends(require_api_key)])


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    agent: AgentRunner = Depends(get_agent_runner),
) -> ChatResponse:
    result = await agent.run(request)
    return ChatResponse(**result)


@router.post("/stream")
async def stream_chat(
    request: ChatRequest,
    agent: AgentRunner = Depends(get_agent_runner),
) -> StreamingResponse:
    async def events() -> AsyncIterator[str]:
        result = await agent.run(request)
        words = result["answer"].split(" ")
        for word in words:
            payload = json.dumps({"type": "token", "text": f"{word} "})
            yield f"event: token\ndata: {payload}\n\n"

        done = json.dumps(
            {
                "type": "done",
                "citations": result["citations"],
                "tool_results": result["tool_results"],
                "trace_id": result["trace_id"],
                "route": result["route"],
            }
        )
        yield f"event: done\ndata: {done}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")
