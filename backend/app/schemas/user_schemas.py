"""Schémas Pydantic — Utilisateurs et Auth."""
import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from core.constants import UserRole


class UserCreate(BaseModel):
    username:  str      = Field(..., min_length=3, max_length=150)
    email:     EmailStr
    password:  str      = Field(..., min_length=8)
    role:      UserRole = UserRole.READER
    team_scope:Optional[str]       = None
    perimeter: Optional[List[str]] = None   # ["NETWORK","AUTH",...]


class UserUpdate(BaseModel):
    username:   Optional[str]       = None
    role:       Optional[UserRole]  = None
    team_scope: Optional[str]       = None
    perimeter:  Optional[List[str]] = None
    is_active:  Optional[bool]      = None


class UserResponse(BaseModel):
    id:               uuid.UUID
    username:         str
    email:            str
    role:             UserRole
    is_active:        bool
    mfa_enabled:      bool
    team_scope:       Optional[str]
    perimeter:        Optional[str]
    risk_score:       float
    created_at:       datetime
    last_login:       Optional[datetime]
    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


class MFASetupResponse(BaseModel):
    totp_uri: str
    secret:   str


class MFAVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         UserResponse
    mfa_required: bool = False


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8)