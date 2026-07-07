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
     # Pour Gmail : activer "Mots de passe d'application" dans le compte Google
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    webhook_url: str = ""

    # Destinataires des alertes (comma-separated)
    alert_recipients: str = ""       # ex: admin@ctu.gov,rssi@ctu.gov

     # ── Webhook Slack/Teams ───────────────────────────────────────────────────
    # Slack  : https://api.slack.com/messaging/webhooks
    # Teams  : https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors
    webhook_url:  str = ""           # URL du webhook entrant
 
    # ── SMS (optionnel — Twilio) ──────────────────────────────────────────────
    twilio_account_sid: str = ""
    twilio_auth_token:  str = ""
    twilio_from_number: str = ""
    twilio_to_number:   str = ""     # Numero astreinte (+237XXXXXXXXX)

    # CORS
    allowed_origins: str = "http://localhost:3000,http://localhost:5173"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def alert_recipients_list(self) -> List[str]:
        return [r.strip() for r in self.alert_recipients.split(",") if r.strip()]
 
    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_user and self.smtp_password)
 
    @property
    def webhook_configured(self) -> bool:
        return bool(self.webhook_url)
 
    @property
    def sms_configured(self) -> bool:
        return bool(self.twilio_account_sid and self.twilio_auth_token and self.twilio_to_number)


settings = Settings()