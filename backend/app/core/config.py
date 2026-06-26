"""Configuration centralisée — Smart SIEM (Pydantic Settings)."""
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "Smart SIEM"
    app_version: str = "1.0.0"
    app_env: str = "development"
    debug: bool = True

    # Serveur
    host: str = "0.0.0.0"
    port: int = 8000

    # PostgreSQL
    database_url: str = "postgresql+asyncpg://siem_user:siem_password@127.0.0.1:5432/smart_siem"

    # Elasticsearch
    elasticsearch_url: str = "http://localhost:9200"
    elasticsearch_index_logs: str = "logs"
    elasticsearch_user: str = ""
    elasticsearch_password: str = ""

    # Sécurité JWT
    secret_key: str = "change_this_in_production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # MFA
    mfa_issuer: str = "SmartSIEM"

    # Rétention
    log_retention_days: int = 30

    # Notifications
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "siem-alerts@ucac-icam.cm"
    webhook_url: str = ""

    # CORS
    allowed_origins: str = "http://localhost:3000,http://localhost:5173"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


settings = Settings()