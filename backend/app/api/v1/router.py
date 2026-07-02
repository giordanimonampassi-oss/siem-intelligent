"""Routeur API v1 — Smart SIEM — Modules 1, 2, 3 + Auth + Notifications."""
from fastapi import APIRouter
from api.v1.endpoints import auth, logs, alerts, rules, notifications, incidents

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(logs.router)
api_router.include_router(alerts.router)
api_router.include_router(rules.router)
api_router.include_router(notifications.router)
api_router.include_router(incidents.router)   # ← Ajoute cette api