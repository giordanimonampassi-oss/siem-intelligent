"""
Smart SIEM – Script d'initialisation de la base de données PostgreSQL.
Exécuté automatiquement au démarrage du conteneur Python.
"""

import os
import sys
import time
import logging

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

# Option recommandée (import relatif)
from database.models import Base

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def get_database_url() -> str:
    return (
        f"postgresql+psycopg2://"
        f"{os.getenv('POSTGRES_USER', 'siem_user')}:"
        f"{os.getenv('POSTGRES_PASSWORD', 'siem_password')}@"
        f"{os.getenv('POSTGRES_HOST', 'postgres')}:"
        f"{os.getenv('POSTGRES_PORT', '5432')}/"
        f"{os.getenv('POSTGRES_DB', 'siem_db')}"
    )


def wait_for_postgres(engine, retries: int = 15, delay: int = 4) -> None:
    """Attend que PostgreSQL soit prêt avant de continuer."""
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("✅  PostgreSQL est prêt.")
            return
        except OperationalError as exc:
            logger.warning(
                f"⏳  Tentative {attempt}/{retries} – PostgreSQL pas encore prêt : {exc}"
            )
            time.sleep(delay)

    logger.error("❌  PostgreSQL inaccessible après plusieurs tentatives. Arrêt.")
    sys.exit(1)


def create_tables(engine) -> None:
    """Crée toutes les tables SQLAlchemy si elles n'existent pas."""
    logger.info("📐  Création des tables (CREATE TABLE IF NOT EXISTS)…")
    Base.metadata.create_all(bind=engine)
    logger.info("✅  Toutes les tables sont en place.")


def run_alembic_migrations() -> None:
    """Lance les migrations Alembic (upgrade head)."""
    import subprocess

    logger.info("🔄  Exécution des migrations Alembic…")
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        logger.error(f"❌  Alembic a échoué :\n{result.stderr}")
        sys.exit(1)
    logger.info(f"✅  Migrations appliquées.\n{result.stdout}")


def main() -> None:
    db_url = get_database_url()
    logger.info(f"🔗  Connexion à : {db_url.split('@')[1]}")  # masque les credentials

    engine = create_engine(db_url, echo=False, pool_pre_ping=True)

    wait_for_postgres(engine)

    use_alembic = os.getenv("USE_ALEMBIC", "false").lower() == "true"

    if use_alembic:
        run_alembic_migrations()
    else:
        create_tables(engine)

    logger.info("🚀  Initialisation terminée. Le service SIEM est prêt.")


if __name__ == "__main__":
    main()
