import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel.ext.asyncio.session import AsyncSession

from app.agents.graph import AgentRunner
from app.api.deps import get_agent_runner, get_current_user
from app.db import conversations as conversation_repo
from app.db.database import SessionDep, get_engine
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


async def _save_answer(session: AsyncSession, result: dict) -> str:
    message = await conversation_repo.add_message(
        session,
        conversation_id=result["conversation_id"],
        role="assistant",
        content=result["answer"],
        route=result["route"],
        trace_id=result["trace_id"],
        citations=result["citations"],
        tool_results=result["tool_results"],
        suggestions=result.get("suggestions"),
    )
    return message.id


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
    message_id = await _save_answer(session, result)
    return ChatResponse(**result, message_id=message_id)


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

    async def events() -> AsyncIterator[str]:
        message_id = None
        try:
            async for event in agent.stream(request, conversation_id):
                # The request-scoped session may already be closed once streaming starts,
                # so the answer is saved with a session of its own.
                if event["type"] == "done":
                    async with AsyncSession(get_engine()) as stream_session:
                        message_id = await _save_answer(stream_session, event)
                    event = {key: value for key, value in event.items() if key != "answer"}
                    event["message_id"] = message_id
                elif event["type"] == "suggestions" and message_id:
                    async with AsyncSession(get_engine()) as stream_session:
                        await conversation_repo.set_suggestions(
                            stream_session, message_id=message_id, suggestions=event["questions"]
                        )
                    event["message_id"] = message_id
                yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"
        except Exception as exc:  # surface model/provider failures to the UI
            payload = json.dumps({"type": "error", "detail": str(exc)})
            yield f"event: error\ndata: {payload}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")
