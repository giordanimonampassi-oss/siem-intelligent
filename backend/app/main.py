"""
Smart SIEM — Point d'entrée FastAPI
Module 1 : Collecte, Normalisation, Stockage, Auth
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from api.v1.router import api_router
from db.database import init_db, init_elasticsearch, es_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialisation au démarrage, nettoyage à l'arrêt."""
    print("🚀 Smart SIEM démarrage...")
    await init_db()
    await init_elasticsearch()
    print("✅ Bases de données prêtes.")
    yield
    # Fermeture
    await es_client.close()
    print("🛑 Smart SIEM arrêté.")


app = FastAPI(
    title="Smart SIEM API",
    version=settings.app_version,
    description="Security Information and Event Management — CTU Project UCAC/ICAM",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(api_router)


@app.get("/health", tags=["Health"])
async def root_health():
    return {
        "status": "ok",
        "app":    settings.app_name, 
        "version":settings.app_version,
        "env":    settings.app_env,
    }