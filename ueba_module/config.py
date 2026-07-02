"""
config.py
Centralise toute la configuration du module UEBA : connexions ES/Postgres,
hyperparamètres du modèle, chemins de fichiers. Tout est piloté par variables
d'environnement (.env) pour respecter le 12-factor app et éviter les secrets
en dur dans le code.
"""
from __future__ import annotations

import os
from pathlib import Path
from dataclasses import dataclass, field

from dotenv import load_dotenv

# Charge le fichier .env situé à la racine du module (s'il existe)
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _get_bool(key: str, default: bool) -> bool:
    val = os.getenv(key)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


def _get_int(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, default))
    except (TypeError, ValueError):
        return default


def _get_float(key: str, default: float) -> float:
    try:
        return float(os.getenv(key, default))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class ElasticsearchConfig:
    host: str = os.getenv("ES_HOST", "https://localhost:9200")
    user: str = os.getenv("ES_USER", "elastic")
    password: str = os.getenv("ES_PASSWORD", "")
    index: str = os.getenv("ES_INDEX", "siem-logs")
    verify_certs: bool = _get_bool("ES_VERIFY_CERTS", False)


@dataclass(frozen=True)
class PostgresConfig:
    host: str = os.getenv("PG_HOST", "localhost")
    port: int = _get_int("PG_PORT", 5432)
    db: str = os.getenv("PG_DB", "smart_siem")
    user: str = os.getenv("PG_USER", "postgres")
    password: str = os.getenv("PG_PASSWORD", "")

    @property
    def sqlalchemy_uri(self) -> str:
        return (
            f"postgresql+psycopg2://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.db}"
        )


@dataclass(frozen=True)
class ModelConfig:
    contamination: float = _get_float("ISOLATION_FOREST_CONTAMINATION", 0.05)
    n_estimators: int = _get_int("ISOLATION_FOREST_N_ESTIMATORS", 200)
    random_state: int = _get_int("RANDOM_STATE", 42)
    anomaly_score_threshold: float = _get_float("ANOMALY_SCORE_THRESHOLD", 0.0)
    model_path: Path = BASE_DIR / "saved_models" / "isolation_forest.pkl"
    scaler_path: Path = BASE_DIR / "saved_models" / "scaler_standard.pkl"
    feature_names_path: Path = BASE_DIR / "saved_models" / "feature_names.json"


@dataclass(frozen=True)
class PipelineConfig:
    # MODIFICATION ICI : 'baseline_logs.csv' devient la valeur par défaut à la place de 'BENIGN.csv'
    baseline_csv_path: Path = BASE_DIR / os.getenv(
        "BASELINE_CSV_PATH", "data/1_baseline/baseline_logs.csv"
    )
    test_dir: Path = BASE_DIR / "data" / "2_test"
    anomalies_dir: Path = BASE_DIR / "data" / "3_anomalies"
    batch_size: int = _get_int("BATCH_SIZE", 5000)
    extraction_window_minutes: int = _get_int("EXTRACTION_WINDOW_MINUTES", 15)


@dataclass(frozen=True)
class APIConfig:
    host: str = os.getenv("API_HOST", "0.0.0.0")
    port: int = _get_int("API_PORT", 8000)


@dataclass(frozen=True)
class LoggingConfig:
    level: str = os.getenv("LOG_LEVEL", "INFO")
    log_dir: Path = BASE_DIR / os.getenv("LOG_DIR", "logs")


# Instances exportées, prêtes à l'emploi dans tout le module
ES_CONFIG = ElasticsearchConfig()
PG_CONFIG = PostgresConfig()
MODEL_CONFIG = ModelConfig()
PIPELINE_CONFIG = PipelineConfig()
API_CONFIG = APIConfig()
LOGGING_CONFIG = LoggingConfig()

# Colonnes de log_entries jugées pertinentes pour le feature engineering UEBA.
RAW_LOG_COLUMNS = [
    "timestamp",
    "source_ip",
    "dest_ip",
    "host",
    "username",
    "log_type",
    "severity",
    "raw_message",
]

SEVERITY_ORDER = {"info": 0, "warning": 1, "error": 2, "critical": 3}