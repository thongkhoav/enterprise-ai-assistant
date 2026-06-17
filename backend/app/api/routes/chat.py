import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.agents.graph import AgentRunner
from app.api.deps import get_agent_runner, get_current_user
from app.db import conversations as conversation_repo
from app.db.database import SessionDep
from app.db.models import User
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"])


def _title_from_message(message: str) -> str:
    title = message.strip().split("\n", maxsplit=1)[0][:60]
    return title or "New conversation"


async def _resolve_conversation_id(
    session: SessionDep, request: ChatRequest, user: User
) -> str:
    """Return an owned conversation id, creating a new conversation when needed."""
    if request.conversation_id:
        conversation = await conversation_repo.get_conversation(
            session, conversation_id=request.conversation_id, user_id=user.id
        )
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conversation.id

    conversation = await conversation_repo.create_conversation(
        session, user_id=user.id, title=_title_from_message(request.message)
    )
    return conversation.id


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    session: SessionDep,
    agent: AgentRunner = Depends(get_agent_runner),
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    conversation_id = await _resolve_conversation_id(session, request, current_user)

    await conversation_repo.add_message(
        session, conversation_id=conversation_id, role="user", content=request.message
    )

    result = await agent.run(request, conversation_id)

    await conversation_repo.add_message(
        session,
        conversation_id=conversation_id,
        role="assistant",
        content=result["answer"],
        route=result["route"],
        trace_id=result["trace_id"],
        citations=result["citations"],
        tool_results=result["tool_results"],
    )

    return ChatResponse(**result)


@router.post("/stream")
async def stream_chat(
    request: ChatRequest,
    session: SessionDep,
    agent: AgentRunner = Depends(get_agent_runner),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    conversation_id = await _resolve_conversation_id(session, request, current_user)

    await conversation_repo.add_message(
        session, conversation_id=conversation_id, role="user", content=request.message
    )

    result = await agent.run(request, conversation_id)

    # The agent runs to completion before streaming begins (tokens are split
    # post-hoc), so the request-scoped session is still open here.
    await conversation_repo.add_message(
        session,
        conversation_id=conversation_id,
        role="assistant",
        content=result["answer"],
        route=result["route"],
        trace_id=result["trace_id"],
        citations=result["citations"],
        tool_results=result["tool_results"],
    )

    async def events() -> AsyncIterator[str]:
        words = result["answer"].split(" ")
        for word in words:
            payload = json.dumps({"type": "token", "text": f"{word} "})
            yield f"event: token\ndata: {payload}\n\n"

        done = json.dumps(
            {
                "type": "done",
                "conversation_id": conversation_id,
                "citations": result["citations"],
                "tool_results": result["tool_results"],
                "trace_id": result["trace_id"],
                "route": result["route"],
            }
        )
        yield f"event: done\ndata: {done}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")
