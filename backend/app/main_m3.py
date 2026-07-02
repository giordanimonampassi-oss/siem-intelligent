"""
Smart SIEM — Point d'entree FastAPI (Modules 1, 2, 3).
Nouveaute Module 3 : seed des regles MITRE au demarrage.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from api.v1.router_m3 import api_router
from db.database import init_db, init_elasticsearch, es_client
from services.rule_service import seed_mitre_rules
from db.database import AsyncSessionLocal


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Smart SIEM demarrage...")
    await init_db()
    await init_elasticsearch()

    # Seed automatique des 5 regles MITRE ATT&CK obligatoires
    async with AsyncSessionLocal() as db:
        created = await seed_mitre_rules(db)
        if created:
            print(f"[Module 3] {created} regle(s) MITRE ATT&CK creee(s) automatiquement.")
        else:
            print("[Module 3] Regles MITRE deja presentes.")

    print("Pret — Modules 1, 2, 3 actifs.")
    yield
    await es_client.close()
    print("Arret.")


app = FastAPI(
    title="Smart SIEM API",
    version=settings.app_version,
    description="CTU Security Operations Center — Modules 1, 2, 3",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

include_router(api_router)


@get("/health", tags=["Health"])
async def health():
    return {
        "status":  "ok",
        "app":     settings.app_name,
        "version": settings.app_version,
        "modules": ["collecte", "stockage", "correlation", "soar", "alertes"],
    }