"""
Service SOAR — Module 3.
Orchestre : blocage IP, desactivation compte, escalade webhook/email.
Modes : AUTO (immediat) | SEMI_AUTO (confirmation 60s).
"""
import json
import asyncio
import smtplib
import uuid
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.config import settings
from core.constants import PlaybookMode, PlaybookStatus, PlaybookType, LogSeverity, AlertSeverity
from models.playbook import PlaybookExecution
from models.alert import Alert
from services.notifier import notify_all, send_email_alert


# ─── Actions (simulees — a remplacer par vraies integrations) ─────────────────

async def _block_ip(ip: str, db: AsyncSession) -> dict:
    """
    Bloque reellement l'IP au niveau applicatif : toute requete future vers
    l'API Smart SIEM depuis cette IP sera rejetee (403) par le middleware,
    tant que le blocage est actif (60 min par defaut).
    """
    from services.firewall_service import block_ip as fw_block_ip
    entry = await fw_block_ip(db, ip, reason="Blocage automatique SOAR", duration_minutes=60)
    return {
        "action":     "block_ip",
        "ip":         ip,
        "result":     "blocked",
        "system":     "application-blocklist",
        "expires_at": entry.expires_at.isoformat() if entry.expires_at else None,
        "timestamp":  datetime.now(timezone.utc).isoformat(),
    } 


async def _disable_account(username: str) -> dict:
    """
    Simule la desactivation d'un compte.
    Production : LDAP via ldap3, Azure AD Graph API, etc.
    """
    await asyncio.sleep(0.08)
    return {
        "action":    "disable_account",
        "username":  username,
        "result":    "disabled",
        "system":    "simulated-ldap",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

def _alert_to_dict(alert: Alert) -> dict:
    """Convertit l'objet Alert SQLAlchemy en dict pour le notifier."""
    return {
        "alert_id": alert.alert_id, "severity": alert.severity, "title": alert.title,
        "description": alert.description, "source_ip": alert.source_ip,
        "target_host": alert.target_host, "username": alert.username,
        "confidence": alert.confidence, "mitre_tactic": alert.mitre_tactic,
        "mitre_technique": alert.mitre_technique,
        "triggered_at": alert.triggered_at.isoformat() if alert.triggered_at else None,
    }


# async def _send_webhook(alert: Alert) -> dict:
#     """Envoie une notification d'escalade via webhook Slack/Teams."""
#     if not settings.webhook_url:
#         return {"action": "webhook", "result": "skipped", "reason": "no webhook_url configured"}

#     sev_emoji = {
#         "CRITICAL": "🚨", "HIGH": "⚠️", "WARNING": "🔶", "INFO": "ℹ️"
#     }.get(alert.severity, "🔔")

#     payload = {
#         "text": (
#             f"{sev_emoji} *ALERTE {alert.severity}* — {alert.title or 'Sans titre'}\n"
#             f"• Reglee : `{alert.mitre_tactic or 'N/A'} / {alert.mitre_technique or 'N/A'}`\n"
#             f"• Source IP : `{alert.source_ip or 'inconnue'}`\n"
#             f"• Cible : `{alert.target_host or 'inconnue'}`\n"
#             f"• Compte : `{alert.username or '—'}`\n"
#             f"• Confiance : {int((alert.confidence or 0) * 100)}%\n"
#             f"• Declenche : {alert.triggered_at.isoformat() if alert.triggered_at else 'N/A'}\n"
#             f"• ID : `{alert.alert_id}`"
#         )
#     }
#     try:
#         async with httpx.AsyncClient(timeout=10) as client:
#             resp = await client.post(settings.webhook_url, json=payload)
#             return {
#                 "action":      "webhook",
#                 "result":      "sent" if resp.status_code < 300 else "error",
#                 "status_code": resp.status_code,
#                 "timestamp":   datetime.now(timezone.utc).isoformat(),
#             }
#     except Exception as e:
#         return {"action": "webhook", "result": "error", "detail": str(e)}


# async def _send_email(alert: Alert) -> dict:
#     """Envoie un email d'alerte via SMTP."""
#     if not settings.smtp_user or not settings.smtp_password:
#         return {"action": "email", "result": "skipped", "reason": "smtp not configured"}

#     msg = MIMEMultipart("alternative")
#     msg["Subject"] = f"[Smart SIEM] Alerte {alert.severity} — {alert.title or 'Incident detecte'}"
#     msg["From"]    = settings.smtp_from
#     msg["To"]      = settings.smtp_user

#     html = f"""
#     <html><body style="font-family:monospace;background:#0D1117;color:#E6EDF3;padding:20px">
#       <h2 style="color:#F85149">[{alert.severity}] {alert.title or 'Alerte Smart SIEM'}</h2>
#       <table style="border-collapse:collapse;width:100%">
#         <tr><td style="padding:6px;color:#8B949E">MITRE</td>
#             <td style="padding:6px">{alert.mitre_tactic or 'N/A'} / {alert.mitre_technique or 'N/A'}</td></tr>
#         <tr><td style="padding:6px;color:#8B949E">Source IP</td>
#             <td style="padding:6px;font-family:monospace">{alert.source_ip or '—'}</td></tr>
#         <tr><td style="padding:6px;color:#8B949E">Cible</td>
#             <td style="padding:6px">{alert.target_host or '—'}</td></tr>
#         <tr><td style="padding:6px;color:#8B949E">Utilisateur</td>
#             <td style="padding:6px">{alert.username or '—'}</td></tr>
#         <tr><td style="padding:6px;color:#8B949E">Confiance</td>
#             <td style="padding:6px">{int((alert.confidence or 0) * 100)}%</td></tr>
#         <tr><td style="padding:6px;color:#8B949E">Description</td>
#             <td style="padding:6px">{alert.description or '—'}</td></tr>
#       </table>
#       <p style="color:#8B949E;font-size:11px;margin-top:20px">Smart SIEM — CTU Security Operations Center</p>
#     </body></html>
#     """
#     msg.attach(MIMEText(html, "html"))

#     try:
#         with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
#             server.starttls()
#             server.login(settings.smtp_user, settings.smtp_password)
#             server.sendmail(settings.smtp_from, settings.smtp_user, msg.as_string())
#         return {"action": "email", "result": "sent", "timestamp": datetime.now(timezone.utc).isoformat()}
#     except Exception as e:
#         return {"action": "email", "result": "error", "detail": str(e)}


# ─── Executeur de playbook ────────────────────────────────────────────────────

async def execute_playbook(
    execution: PlaybookExecution,
    alert: Alert,
    db: AsyncSession,
) -> None:
    """
    Execute un playbook SOAR selon son type et son mode.
    Mode CONFIRM : attend expiration du delai avant d'agir.
    """
    now = datetime.now(timezone.utc)
 
    # Mode CONFIRM : verifier le delai de grace
    if execution.mode == PlaybookMode.CONFIRM.value:
        if execution.confirm_deadline and now < execution.confirm_deadline:
            return
        if execution.status == PlaybookStatus.CANCELLED.value:
            return
 
    execution.status = PlaybookStatus.RUNNING.value
    await db.commit()
 
    try:
        result = {}
        target = execution.target
 
        if execution.playbook == PlaybookType.BLOCK_IP.value:
            ip = target or alert.source_ip
            if not ip:
                raise ValueError("Aucune IP cible")
            result = await _block_ip(ip, db)
 
        elif execution.playbook == PlaybookType.DISABLE_ACCOUNT.value:
            username = target or alert.username
            if not username:
                raise ValueError("Aucun compte cible")
            result = await _disable_account(username)
 
        elif execution.playbook == PlaybookType.ESCALATE.value:
            # Email uniquement pour l'instant (webhook/SMS non branches ici)
            email_r = await send_email_alert(_alert_to_dict(alert))
            result = {"email": email_r}
 
        execution.status      = PlaybookStatus.COMPLETED.value
        execution.detail      = json.dumps(result)
        execution.executed_at = datetime.now(timezone.utc)
 
    except Exception as e:
        execution.status = PlaybookStatus.FAILED.value
        execution.detail = json.dumps({"error": str(e)})
 
    await db.commit()
 
 
# ─── Declenchement automatique ────────────────────────────────────────────────
 
async def trigger_auto_playbooks(
    alert: Alert,
    db: AsyncSession,
) -> List[PlaybookExecution]:
    """
    Declenche automatiquement les playbooks selon le niveau d'alerte :
    CRITICAL → block_ip (AUTO) + disable_account (CONFIRM 60s) + escalate (AUTO)
    HIGH     → escalate (AUTO)
    WARNING  → escalate (AUTO)
 
    NB : alert.severity contient des valeurs AlertSeverity (INFO/WARNING/HIGH/
    CRITICAL, majuscules) — PAS LogSeverity (info/warning/critical, minuscules,
    reserve aux logs bruts). Comparer avec le mauvais enum fait que ce
    declenchement ne se produit jamais, silencieusement.
    """
    executions = []
    now = datetime.now(timezone.utc)
 
    if alert.severity == AlertSeverity.CRITICAL.value:
        # 1. Blocage IP (immediat)
        if alert.source_ip:
            pb = PlaybookExecution(
                alert_id=alert.id,
                playbook=PlaybookType.BLOCK_IP.value,
                mode=PlaybookMode.AUTO.value,
                target=alert.source_ip,
                status=PlaybookStatus.PENDING.value,
            )
            db.add(pb)
            await db.flush()
            await execute_playbook(pb, alert, db)
            executions.append(pb)
 
        # 2. Desactivation compte (CONFIRM 60s)
        if alert.username:
            pb = PlaybookExecution(
                alert_id=alert.id,
                playbook=PlaybookType.DISABLE_ACCOUNT.value,
                mode=PlaybookMode.CONFIRM.value,
                target=alert.username,
                status=PlaybookStatus.PENDING.value,
                confirm_deadline=now + timedelta(seconds=60),
            )
            db.add(pb)
            executions.append(pb)
 
    if alert.severity in (AlertSeverity.CRITICAL.value, AlertSeverity.HIGH.value, AlertSeverity.WARNING.value):
        # 3. Escalade (email)
        pb = PlaybookExecution(
            alert_id=alert.id,
            playbook=PlaybookType.ESCALATE.value,
            mode=PlaybookMode.AUTO.value,
            status=PlaybookStatus.PENDING.value,
        )
        db.add(pb)
        await db.flush()
        await execute_playbook(pb, alert, db)
        executions.append(pb)
 
    await db.commit()
    return executions
 
 
async def sweep_expired_confirmations(db: AsyncSession) -> int:
    """
    Execute automatiquement les playbooks CONFIRM dont le delai de grace
    est expire et qui n'ont pas ete annules. A appeler periodiquement
    (scheduler), pas seulement sur clic manuel "Confirmer".
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(PlaybookExecution).where(
            PlaybookExecution.status == PlaybookStatus.PENDING.value,
            PlaybookExecution.confirm_deadline.isnot(None),
            PlaybookExecution.confirm_deadline <= now,
        )
    )
    pending = result.scalars().all()
    count = 0
    for execution in pending:
        alert = (await db.execute(select(Alert).where(Alert.id == execution.alert_id))).scalar_one_or_none()
        if alert:
            await execute_playbook(execution, alert, db)
            count += 1
    return count