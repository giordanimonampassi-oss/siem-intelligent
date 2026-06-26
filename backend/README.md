# Smart SIEM — Module 1 : Collecte, Normalisation, Stockage

**Projet UCAC/ICAM — CTU Security Operations Center**

---

## Structure du projet

```
smart_siem/
├── main.py                         ← Point d'entrée FastAPI
├── requirements.txt
├── .env                            ← Variables d'environnement (à configurer)
├── app/
│   ├── core/
│   │   ├── config.py               ← Settings Pydantic (lit le .env)
│   │   ├── constants.py            ← Enums : UserRole, LogType, LogSeverity...
│   │   └── security.py             ← bcrypt, JWT, TOTP (RFC 6238)
│   ├── db/
│   │   └── database.py             ← Connexions PostgreSQL + Elasticsearch
│   ├── models/
│   │   ├── user.py                 ← Table users (PostgreSQL)
│   │   ├── log_entry.py            ← Table log_entries (PostgreSQL)
│   │   └── audit_log.py            ← Table audit_logs (PostgreSQL)
│   ├── schemas/
│   │   ├── log_schemas.py          ← Pydantic : LogIngest, LogDetail, SearchParams...
│   │   └── user_schemas.py         ← Pydantic : UserCreate, TokenResponse...
│   ├── services/
│   │   ├── normalizer.py           ← Pipeline de normalisation des logs
│   │   ├── log_service.py          ← Ingestion PG + ES, recherche, SHA-256
│   │   └── auth_service.py         ← Authentification, MFA, audit
│   └── api/v1/
│       ├── dependencies.py         ← get_db, get_es, get_current_user, RBAC
│       ├── router.py               ← Agrège tous les routers
│       └── endpoints/
│           ├── auth.py             ← /api/v1/auth/*
│           └── logs.py             ← /api/v1/logs/*
├── scripts/
│   └── seed_data.py                ← Génère 1000 logs de test
├── tests/
│   └── test_module1.py             ← 27 tests unitaires
└── docker/
    ├── docker-compose.yml          ← PostgreSQL + Elasticsearch + API
    └── Dockerfile
```

---

## Prérequis

- Python 3.12+
- Docker & Docker Compose
- PostgreSQL 16 et Elasticsearch 8.15 (fournis par le docker-compose)

---

## Installation

### 1. Cloner et installer les dépendances

```bash
pip install -r requirements.txt
```

### 2. Configurer le `.env`

Remplir les valeurs dans `.env` avec les infos de ton camarade BDD :
```
DATABASE_URL=postgresql+asyncpg://siem_user:siem_password@localhost:5432/smart_siem
ELASTICSEARCH_URL=http://localhost:9200
SECRET_KEY=<générer avec : openssl rand -hex 32>
```

### 3. Démarrer les bases de données

```bash
cd docker
docker-compose up postgres elasticsearch -d
```

Attendre ~30 secondes que les deux services soient healthy.

### 4. Démarrer l'API

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Au démarrage, l'API crée automatiquement :
- Les tables PostgreSQL (`users`, `log_entries`, `audit_logs`)
- L'index Elasticsearch `logs` avec le bon mapping

### 5. Générer des données de test

```bash
python scripts/seed_data.py
```

Génère **1000 logs simulés** avec 3 scénarios d'attaque cachés (Brute Force SSH, Mouvement latéral, Exfiltration Nina Myers).

---

## Créer le premier utilisateur admin

L'endpoint `/api/v1/auth/register` est protégé (admin only).
Pour bootstrapper, ajouter temporairement ce script :

```python
# scripts/create_admin.py
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import AsyncSessionLocal, init_db
from app.services.auth_service import create_user
from app.schemas.user_schemas import UserCreate
from app.core.constants import UserRole

async def main():
    await init_db()
    async with AsyncSessionLocal() as db:
        user = await create_user(UserCreate(
            username="admin",
            email="admin@ctu.gov",
            password="Admin@SIEM2026",
            role=UserRole.ADMIN,
            perimeter=["network", "auth", "system", "application"],
        ), db)
        print(f"Admin créé : {user.email} (id={user.id})")

asyncio.run(main())
```

```bash
python scripts/create_admin.py
```

---

## Endpoints disponibles

### Authentification

| Méthode | Endpoint                  | Description                          |
|---------|---------------------------|--------------------------------------|
| POST    | `/api/v1/auth/login`      | Login (email + password)             |
| POST    | `/api/v1/auth/mfa/setup`  | Génère QR code TOTP (premier login)  |
| POST    | `/api/v1/auth/mfa/confirm`| Active le MFA                        |
| POST    | `/api/v1/auth/mfa/verify` | Vérifie le code TOTP (step 2 login)  |
| POST    | `/api/v1/auth/register`   | Crée un utilisateur (admin only)     |
| GET     | `/api/v1/auth/me`         | Profil utilisateur courant           |

### Logs

| Méthode | Endpoint                        | Description                               |
|---------|---------------------------------|-------------------------------------------|
| POST    | `/api/v1/logs`                  | Ingestion unique                          |
| POST    | `/api/v1/logs/batch`            | Ingestion par lot (max 500)               |
| GET     | `/api/v1/logs`                  | Recherche multi-critères (PG ou ES)       |
| GET     | `/api/v1/logs/{id}`             | Détail d'un log                           |
| PATCH   | `/api/v1/logs/{id}/flag`        | Marquer comme suspect                     |
| POST    | `/api/v1/logs/integrity/{batch_id}` | Hash SHA-256 du lot               |
| GET     | `/api/v1/logs/health/check`     | Santé PostgreSQL + Elasticsearch          |

### Documentation Swagger

```
http://localhost:8000/docs
```

---

## Exemple d'utilisation

### Login

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@ctu.gov", "password": "Admin@SIEM2026"}'
```

### Ingestion d'un log

```bash
TOKEN="eyJ..."
curl -X POST http://localhost:8000/api/v1/logs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "raw_message": "Failed password for root from 178.43.12.87 port 22 ssh2",
    "host": "ctu-srv-01",
    "source_ip": "178.43.12.87"
  }'
```

### Recherche full-text (Elasticsearch)

```bash
curl "http://localhost:8000/api/v1/logs?keyword=brute+force&severity=critical&engine=es" \
  -H "Authorization: Bearer $TOKEN"
```

### Recherche structurée (PostgreSQL)

```bash
curl "http://localhost:8000/api/v1/logs?source_ip=178.43.12.87&log_type=auth&engine=pg" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Lancer les tests

```bash
# Tests unitaires (ne nécessitent pas PG ni ES)
pytest tests/test_module1.py -v -k "TestNormalizer or TestSecurity or TestSchemas or TestIntegrity"

# Tous les tests
pytest tests/test_module1.py -v
```

Résultat attendu : **27 tests passent** ✅

---

## Architecture hybride PostgreSQL + Elasticsearch

| Opération              | Base utilisée   | Raison                                       |
|------------------------|-----------------|----------------------------------------------|
| Stockage principal     | PostgreSQL      | ACID, intégrité, relations, SHA-256          |
| Indexation full-text   | Elasticsearch   | Recherche rapide sur millions de logs        |
| Recherche par IP/user  | Au choix (pg/es)| PG pour exact match, ES pour full-text       |
| Audit logs             | PostgreSQL      | Traçabilité réglementaire                    |
| Users & roles          | PostgreSQL      | Intégrité référentielle                      |

---

## Ce qui reste pour la Semaine 2 (Module 2)

- Moteur de corrélation (`correlator.py`) → règles threshold + pattern
- Système d'alertes multicanal (email + webhook)
- 3 playbooks SOAR (blocage IP, désactivation compte, escalade)
- 5 règles MITRE ATT&CK actives