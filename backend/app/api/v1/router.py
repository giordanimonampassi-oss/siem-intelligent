"""Routeur API v1 — Smart SIEM — Modules 1, 2, 3, 4, 5 + Auth + Notifications."""
from fastapi import APIRouter
from api.v1.endpoints import (
    auth, logs, alerts, rules, notifications, incidents,
    reports, ueba, playbooks,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(logs.router)
api_router.include_router(alerts.router)
api_router.include_router(rules.router)
api_router.include_router(notifications.router)
api_router.include_router(incidents.router)
api_router.include_router(reports.router)     
api_router.include_router(ueba.router)        
api_router.include_router(playbooks.router)   