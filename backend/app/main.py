"""
Smart SIEM — Point d'entree FastAPI
Modules : 1 (Collecte), 2 (Stockage), 3 (Correlation + SOAR + Alertes + Notifications)
"""
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi import Request
from fastapi.responses import JSONResponse
import traceback

from core.config import settings
from api.v1.router import api_router
from db.database import init_db, init_elasticsearch, es_client, AsyncSessionLocal
from services.rule_service import seed_mitre_rules
from services.ueba_service import snapshot_all_profiles
from services.soar import sweep_expired_confirmations
from services.anomaly_detector import run_batch_detection


scheduler = AsyncIOScheduler()

async def daily_snapshot_job():
    async with AsyncSessionLocal() as db:
        await snapshot_all_profiles(db)

async def confirm_sweep_job():
    async with AsyncSessionLocal() as db:
        await sweep_expired_confirmations(db)

async def anomaly_detection_job():
    async with AsyncSessionLocal() as db:
        await run_batch_detection(db, lookback_seconds=60)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Smart SIEM demarrage...")
    await init_db()
    await init_elasticsearch()

    async with AsyncSessionLocal() as db:
        created = await seed_mitre_rules(db)
        if created:
            print(f"[Module 3] {created} regle(s) MITRE ATT&CK creee(s).")
        else:
            print("[Module 3] Regles MITRE deja presentes.")

    print("Pret — http://localhost:8000/docs")
    scheduler.add_job(daily_snapshot_job, "cron", hour=0, minute=5)
    scheduler.add_job(confirm_sweep_job, "interval", seconds=5)
    scheduler.add_job(anomaly_detection_job, "interval", seconds=30)   # ← nouveau
    scheduler.start()
    yield
    scheduler.shutdown()
    await es_client.close()
    print("Arret.")


app = FastAPI(
    title="Smart SIEM API",
    version=settings.app_version,
    description="""
## Smart SIEM — CTU Security Operations Center

API REST du systeme SIEM intelligent developpe dans le cadre du projet integrateur UCAC/ICAM.

### Modules implementes

| Module | Description | Statut |
|--------|-------------|--------|
| **Module 1** | Collecte et normalisation des logs | ✅ |
| **Module 2** | Stockage PostgreSQL + indexation Elasticsearch | ✅ |
| **Module 3** | Correlation, alertes, SOAR, notifications | ✅ |
| **Auth**     | JWT + MFA TOTP + RBAC 5 roles | ✅ |

### Architecture hybride

- **PostgreSQL** : source de verite (logs, alertes, utilisateurs, audit)
- **Elasticsearch** : indexation full-text pour la recherche forensique
- **Agents** : machines Ubuntu via Tailscale → `POST /api/v1/logs`

### Roles et permissions

| Role    | Logs | Alertes | SOAR | Utilisateurs | Audit |
|---------|------|---------|------|--------------|-------|
| READER  | Lecture | — | — | — | — |
| ANALYST | Lecture + flag | Ack + Resolve | Trigger | — | — |
| RSSI    | Synthese | Synthese | — | — | — |
| AUDITOR | Lecture | Lecture | — | — | ✅ |
| ADMIN   | Tout | Tout | Tout | CRUD | Tout |

### Authentification

1. `POST /api/v1/auth/login` → obtenir le token
2. Cliquer **Authorize** en haut → saisir `Bearer <token>`
3. Toutes les requetes sont alors authentifiees

### Severite des logs (3 niveaux)

- `info` — evenement normal
- `warning` — activite suspecte
- `critical` — incident confirme

### Notifications supportees

- **Gmail SMTP** — configurer `smtp_user` et `smtp_password` dans `.env`
- **Slack / Teams** — configurer `webhook_url` dans `.env`
- **SMS Twilio** — configurer `twilio_*` dans `.env`
- Tester via `POST /api/v1/notifications/test`
""",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
    contact={"name": "CTU Security Operations", "email": "admin@ctu.gov"},
    license_info={"name": "MIT"},
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


FRONTEND_ORIGIN = "http://localhost:5173"
 
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Affiche la vraie trace dans le terminal uvicorn (essentiel pour debug)
    traceback.print_exc()
 
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Erreur interne du serveur",
            "error": str(exc),
            "type": type(exc).__name__,
        },
        headers={
            "Access-Control-Allow-Origin": FRONTEND_ORIGIN,
            "Access-Control-Allow-Credentials": "true",
        },
    )

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(api_router)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get(
    "/health",
    tags=["Health"],
    summary="Sante globale de l'API",
    response_description="Statut de l'application",
)
async def health():
    """
    Verifie que l'API est operationnelle.
    Pour la sante des bases de donnees, utiliser `GET /api/v1/logs/health`.
    """
    return {
        "status":  "ok",
        "app":     settings.app_name,
        "version": settings.app_version,
        "env":     settings.app_env,
        "modules": ["collecte", "stockage", "correlation", "soar", "alertes", "notifications"],
        "docs":    "http://localhost:8000/docs",
    }


# ── OpenAPI personnalise ──────────────────────────────────────────────────────
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        contact=app.contact,
        license_info=app.license_info,
    )

    # Ajouter le schema de securite Bearer JWT
    schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Token JWT obtenu via POST /api/v1/auth/login",
        }
    }

    # Appliquer la securite globalement
    schema["security"] = [{"BearerAuth": []}]

    # Tags avec descriptions
    schema["tags"] = [
        {
            "name": "Health",
            "description": "Sante de l'API et des services.",
        },
        {
            "name": "Authentication & RBAC",
            "description": "Login, MFA TOTP, gestion utilisateurs et roles.",
            "externalDocs": {
                "description": "Flux d'authentification",
                "url": "http://localhost:8000/docs",
            },
        },
        {
            "name": "Logs — Modules 1, 2, 3",
            "description": """
Ingestion, normalisation, stockage et recherche des logs.

**Ingestion unique** : `POST /api/v1/logs`

**Ingestion par lot** : `POST /api/v1/logs/batch` (max 500 logs)

**Moteur de recherche** :
- `engine=es` (defaut) — Elasticsearch, full-text rapide
- `engine=pg` — PostgreSQL, filtres exacts

**Format minimum** : `{"raw_message": "votre log brut"}`

Apres chaque ingestion, le moteur de correlation analyse le log en arriere-plan.
""",
        },
        {
            "name": "Alertes — Module 3",
            "description": """
Gestion du cycle de vie des alertes generees par le correlateur.

**Cycle de vie** : `NEW` → `ACKNOWLEDGED` → `RESOLVED`

**Stats** : `GET /api/v1/alerts/stats` — KPIs pour le dashboard.

**SOAR** : `POST /api/v1/alerts/{id}/trigger-soar` — declenche les playbooks automatiques.
""",
        },
        {
            "name": "Regles de correlation — Module 3",
            "description": """
CRUD des regles MITRE ATT&CK.

**Seed automatique** : 5 regles creees au demarrage.

**Types de regles** :
- `THRESHOLD` — seuil d'evenements dans une fenetre glissante
- `ANOMALY` — mot-cle detecte dans raw_message
- `SEQUENCE` — sequence de types d'evenements

**Toggle** : `POST /api/v1/rules/{id}/toggle` — active/desactive une regle.
""",
        },
        {
            "name": "Notifications — Module 3",
            "description": """
Configuration et test des canaux de notification.

**Canaux disponibles** :
- Email Gmail (SMTP TLS)
- Webhook Slack / Microsoft Teams
- SMS Twilio

**Test rapide** : `POST /api/v1/notifications/test` avec `{"channel": "email"}`.

**Configuration** : voir le fichier `.env` a la racine du backend.
""",
        },
    ]

    app.openapi_schema = schema
    return schema


app.openapi = custom_openapi