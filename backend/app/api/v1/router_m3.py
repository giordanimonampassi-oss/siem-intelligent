"""
Routeur API v1 — Smart SIEM Modules 1, 2, 3.
Remplace app/api/v1/router.py.
"""
from fastapi import APIRouter
from api.v1.endpoints import auth
from api.v1.endpoints.logs_m3 import router as logs_router
from api.v1.endpoints.alerts import router as alerts_router
from api.v1.endpoints.rules import router as rules_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(logs_router)
api_router.include_router(alerts_router)
api_router.include_router(rules_router)