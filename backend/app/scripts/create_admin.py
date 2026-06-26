"""
Script de création du premier compte administrateur.
Usage : python scripts/create_admin.py
        (depuis le dossier backend/)
"""
import asyncio, sys, os
from pathlib import Path

# Setup path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

env_path = PROJECT_ROOT / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=env_path, override=True)

from db.database import AsyncSessionLocal, init_db, init_elasticsearch, es_client
from services.auth_service import create_user
from schemas.user_schemas import UserCreate
from core.constants import UserRole
from sqlalchemy import select
from models.user import CTSUser

USERS_TO_CREATE = [
    UserCreate(
        username="admin",
        email="admin@ctu.gov",
        password="Admin@SIEM2026",
        role=UserRole.ADMIN,
        team_scope="CTU-GLOBAL",
        perimeter=["NETWORK","AUTH","SYSTEM","APPLICATION","CLOUD"],
    ),
    UserCreate(
        username="c.obrian",
        email="c.obrian@ctu.gov",
        password="Analyst@CTU2026",
        role=UserRole.ANALYST,
        team_scope="CTU-SOC",
        perimeter=["NETWORK","AUTH","SYSTEM","APPLICATION"],
    ),
    UserCreate(
        username="b.buchanan",
        email="b.buchanan@ctu.gov",
        password="RSSI@CTU2026",
        role=UserRole.RSSI,
        team_scope="CTU-DIRECTION",
        perimeter=["NETWORK","AUTH","SYSTEM","APPLICATION","CLOUD"],
    ),
    UserCreate(
        username="t.almeida",
        email="t.almeida@ctu.gov",
        password="Auditor@CTU2026",
        role=UserRole.AUDITOR,
        team_scope="CTU-AUDIT",
        perimeter=["NETWORK","AUTH","SYSTEM"],
    ),
    UserCreate(
        username="j.bauer",
        email="j.bauer@ctu.gov",
        password="Reader@CTU2026",
        role=UserRole.READER,
        team_scope="CTU-FIELD",
        perimeter=["NETWORK"],
    ),
]

async def main():
    await init_db()
    await init_elasticsearch()

    async with AsyncSessionLocal() as db:
        for user_data in USERS_TO_CREATE:
            existing = await db.execute(
                select(CTSUser).where(CTSUser.email == user_data.email)
            )
            if existing.scalar_one_or_none():
                print(f"[SKIP] {user_data.email} existe déjà")
                continue
            user = await create_user(user_data, db)
            print(f"[OK] Créé : {user.email} | rôle={user.role} | id={user.id}")

    await es_client.close()
    print("\n✅ Comptes créés. Credentials de test :")
    print("  admin@ctu.gov         / Admin@SIEM2026   (ADMIN)")
    print("  c.obrian@ctu.gov      / Analyst@CTU2026  (ANALYST)")
    print("  b.buchanan@ctu.gov    / RSSI@CTU2026     (RSSI)")
    print("  t.almeida@ctu.gov     / Auditor@CTU2026  (AUDITOR)")
    print("  j.bauer@ctu.gov       / Reader@CTU2026   (READER)")
if __name__ == "__main__":
    # Correction de la boucle d'événements pour Windows et Psycopg
    if sys.platform == "win32":
        import selectors
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
asyncio.run(main())