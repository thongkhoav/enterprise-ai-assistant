from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db import users as user_repo
from app.db.database import SessionDep
from app.db.models import User
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RoleUpdate,
    TokenResponse,
    UserPublic,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    session: SessionDep,
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    existing = await user_repo.get_user_by_email(session, payload.email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = await user_repo.create_user(
        session,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role="admin" if payload.email.lower() in settings.admin_emails else "member",
    )
    token = create_access_token(settings, subject=user.id)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    session: SessionDep,
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    user = await user_repo.get_user_by_email(session, payload.email)
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    token = create_access_token(settings, subject=user.id)
    return TokenResponse(access_token=token)


def _public(user: User, settings: Settings) -> UserPublic:
    return UserPublic(
        **user.model_dump(exclude={"hashed_password"}),
        can_switch_role=settings.demo_role_switch,
    )


@router.get("/me", response_model=UserPublic)
async def me(
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> UserPublic:
    return _public(current_user, settings)


@router.put("/me/role", response_model=UserPublic)
async def switch_role(
    payload: RoleUpdate,
    session: SessionDep,
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> UserPublic:
    """Demo only: try the admin and member sides with one account."""
    if not settings.demo_role_switch:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Roles are managed by an administrator.",
        )
    user = await user_repo.set_role(session, current_user, payload.role)
    return _public(user, settings)
