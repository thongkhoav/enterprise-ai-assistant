from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


Role = Literal["admin", "member"]


class UserPublic(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    role: Role = "member"
    created_at: datetime
    # True on the public demo, where anyone may switch roles to try both sides.
    can_switch_role: bool = False


class RoleUpdate(BaseModel):
    role: Role
