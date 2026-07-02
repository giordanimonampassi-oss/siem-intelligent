"""
Endpoints Notifications — /api/v1/notifications
Configuration Gmail SMTP, Webhook Slack/Teams, SMS Twilio.
Test de chaque canal depuis Swagger.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.dependencies import get_db, get_current_user, require_admin
from models.user import CTSUser
from schemas.alert_schemas import NotificationConfigResponse, NotificationTestRequest
from services.notifier import send_email_alert, send_webhook_alert, send_sms_alert, notify_all
from services.auth_service import log_audit
from core.config import settings

router = APIRouter(prefix="/notifications", tags=["Notifications — Module 3"])

# Alerte de test generique
_TEST_ALERT = {
    "alert_id":        "AL-TEST0001",
    "severity":        "critical",
    "title":           "Test — Alerte Smart SIEM",
    "description":     "Ceci est une alerte de test pour verifier la configuration des notifications.",
    "source_ip":       "178.43.12.87",
    "target_host":     "ctu-srv-01",
    "username":        "admin",
    "confidence":      0.95,
    "mitre_tactic":    "TA0001",
    "mitre_technique": "T1110",
    "triggered_at":    None,
}


@router.get("/config", response_model=NotificationConfigResponse)
async def get_config(current_user: CTSUser = Depends(require_admin)):
    """
    Retourne l'etat de configuration de chaque canal de notification.
    Les credentials sensibles sont masques (jamais exposes en clair).
    """
    smtp_user_masked = None
    if settings.smtp_user:
        parts = settings.smtp_user.split("@")
        if len(parts) == 2:
            smtp_user_masked = f"{parts[0][:3]}***@{parts[1]}"
        else:
            smtp_user_masked = "***"

    return NotificationConfigResponse(
        smtp_configured=settings.smtp_configured,
        webhook_configured=settings.webhook_configured,
        sms_configured=settings.sms_configured,
        smtp_user=smtp_user_masked,
        alert_recipients=settings.alert_recipients_list,
        webhook_url_set=bool(settings.webhook_url),
    )


@router.post("/test")
async def test_notification(
    payload: NotificationTestRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(require_admin),
):
    """
    Envoie une notification de test sur le canal specifie.
    - **email**   : envoie via Gmail SMTP (requiert smtp_user + smtp_password dans .env)
    - **webhook** : envoie vers Slack ou Teams (requiert webhook_url dans .env)
    - **sms**     : envoie via Twilio (requiert twilio_* dans .env)
    - **all**     : teste tous les canaux en parallele
    """
    channel = payload.channel.lower()
    allowed = ("email", "webhook", "sms", "all")
    if channel not in allowed:
        raise HTTPException(status_code=400, detail=f"Canal invalide. Valeurs: {allowed}")

    from datetime import datetime, timezone
    alert = {**_TEST_ALERT, "triggered_at": datetime.now(timezone.utc).isoformat()}

    if channel == "email":
        result = await send_email_alert(alert)
    elif channel == "webhook":
        result = await send_webhook_alert(alert)
    elif channel == "sms":
        result = await send_sms_alert(alert)
    else:
        result = await notify_all(alert)

    await log_audit("notification_test", db, user_id=current_user.id, target=channel,
                    ip=request.client.host if request.client else None,
                    detail=str(result))
    await db.commit()

    return {
        "channel": channel,
        "result":  result,
        "message": "Test de notification execute — consultez le resultat ci-dessus",
    }


@router.get("/channels-status")
async def channels_status(current_user: CTSUser = Depends(get_current_user)):
    """
    Retourne un resume rapide de l'etat de chaque canal (configure ou non).
    Accessible a tous les utilisateurs authentifies.
    """
    return {
        "email":   {"configured": settings.smtp_configured,    "provider": "Gmail SMTP"},
        "webhook": {"configured": settings.webhook_configured, "provider": "Slack / Microsoft Teams"},
        "sms":     {"configured": settings.sms_configured,     "provider": "Twilio"},
    }