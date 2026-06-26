"""Routeur API v1 — Smart SIEM."""
from fastapi import APIRouter
from api.v1.endpoints import auth, logs

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(logs.router)