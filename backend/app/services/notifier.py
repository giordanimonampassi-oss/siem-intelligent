"""
Service de notifications — Smart SIEM Module 3.
Canaux : Email Gmail, Webhook Slack/Teams, SMS Twilio.
"""
import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from pathlib import Path
from typing import Optional
import httpx

from core.config import settings
from core.constants import LogSeverity

# ── Logo — copie ton fichier ici (backend/app/assets/logo.svg) ──────────────
LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "logo.svg"
LOGO_CID  = "smart_siem_logo"


# ── Niveau -> couleur + libelle (badge texte, plus d'image d'icone) ─────────
SEV_META = {
    "critical": {"color": "#F85149", "label": "CRITIQUE"},
    "warning":  {"color": "#E3A325", "label": "AVERTISSEMENT"},
    "info":     {"color": "#58A6FF", "label": "INFO"},
}


def _get_meta(severity: str) -> dict:
    return SEV_META.get(severity.lower(), SEV_META["info"])


def _severity_badge(meta: dict) -> str:
    """Badge colore en texte pur — aucune image, donc jamais casse par un client mail."""
    return (
        f'<span style="display:inline-block;padding:4px 10px;border-radius:6px;'
        f'background:{meta["color"]};color:#0D1117;font-weight:700;'
        f'font-size:12px;letter-spacing:.5px">{meta["label"]}</span>'
    )


# ── Email Gmail ───────────────────────────────────────────────────────────────

def _build_email_html(alert: dict, has_logo: bool) -> str:
    meta  = _get_meta(alert.get("severity", "info"))
    color = meta["color"]
    badge = _severity_badge(meta)
    logo_html = (
        f'<img src="cid:{LOGO_CID}" width="28" height="28" alt="Smart SIEM" '
        f'style="vertical-align:middle;margin-right:10px;display:inline-block;border-radius:6px" />'
        if has_logo else ""
    )
    rows  = [
        ("MITRE ATT&CK",  f"{alert.get('mitre_tactic','N/A')} / {alert.get('mitre_technique','N/A')}"),
        ("Source IP",     alert.get("source_ip") or "—"),
        ("Cible",         alert.get("target_host") or "—"),
        ("Utilisateur",   alert.get("username") or "—"),
        ("Confiance",     f"{int((alert.get('confidence') or 0) * 100)}%"),
        ("Description",   (alert.get("description") or "—")[:200]),
        ("ID Alerte",     alert.get("alert_id") or "—"),
        ("Declenche le",  str(alert.get("triggered_at") or "—")),
    ]
    # IMPORTANT : chaque <td> a desormais une couleur EXPLICITE (label ET valeur).
    # C'etait l'absence de couleur sur la colonne "valeur" qui la rendait invisible.
    rows_html = "".join(
        f"<tr>"
        f"<td style='padding:8px 12px;color:#8B949E;font-size:12px;white-space:nowrap;vertical-align:top'>{k}</td>"
        f"<td style='padding:8px 12px;font-size:12px;font-family:monospace;color:#E6EDF3'>{v}</td>"
        f"</tr>"
        for k, v in rows
    )
    return f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0D1117;font-family:-apple-system,sans-serif;color:#E6EDF3">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#161B22;border-radius:10px;border:1px solid #30363D;overflow:hidden">

        <!-- Header -->
        <tr><td style="background:{color}18;border-bottom:3px solid {color};padding:20px 28px">
          <div style="font-size:11px;color:{color};font-weight:700;letter-spacing:.8px;margin-bottom:10px">
            SMART SIEM — CTU SECURITY OPERATIONS CENTER
          </div>
          <h1 style="margin:0;font-size:20px;color:#E6EDF3">
            {logo_html}<span style="vertical-align:middle">Alerte</span> {badge}
          </h1>
          <div style="font-size:15px;color:#E6EDF3;margin-top:10px;font-weight:600">
            {alert.get('title') or 'Incident detecte'}
          </div>
        </td></tr>

        <!-- Champs -->
        <tr><td style="padding:20px 16px">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="border-collapse:collapse">
            {rows_html}
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:16px 28px 24px;text-align:center">
          <a href="http://localhost:5173"
             style="display:inline-block;padding:10px 24px;background:{color};
                    color:#0D1117;border-radius:6px;font-weight:700;
                    font-size:13px;text-decoration:none">
            Investiguer dans Smart SIEM
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="border-top:1px solid #30363D;padding:14px 28px;
                        font-size:10px;color:#8B949E;text-align:center">
          Smart SIEM — UCAC/ICAM CTU Project &bull; Ce message est genere automatiquement.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


async def send_email_alert(alert: dict) -> dict:
    """Envoie un email HTML via Gmail SMTP avec logo SVG inline."""
    if not settings.smtp_configured:
        return {"channel": "email", "result": "skipped", "reason": "smtp_not_configured"}

    recipients = settings.alert_recipients_list or [settings.smtp_user]

    meta = _get_meta(alert.get("severity", "info"))
    subject = f"[Smart SIEM] [{meta['label']}] {alert.get('title', 'Incident')}"

    # Logo SVG
    logo_path = Path(__file__).resolve().parent.parent / "assets" / "logo.svg"
    has_logo = logo_path.exists()

    # Message principal
    root = MIMEMultipart("related")
    root["Subject"] = subject
    root["From"]    = f"Smart SIEM <{settings.smtp_from}>"
    root["To"]      = ", ".join(recipients)

    # Corps HTML
    html = _build_email_html(alert, has_logo)
    root.attach(MIMEText(html, "html", "utf-8"))

    # Attachement du logo SVG
    if has_logo:
        try:
            with open(logo_path, "rb") as f:
                img = MIMEImage(f.read(), _subtype="svg+xml")   # Important pour SVG
            img.add_header("Content-ID", f"<{LOGO_CID}>")
            img.add_header("Content-Disposition", "inline", filename=logo_path.name)
            root.attach(img)
        except Exception as e:
            print(f"[EMAIL] Erreur logo SVG: {e}")

    def _send():
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as srv:
            srv.ehlo()
            srv.starttls()
            srv.ehlo()
            srv.login(settings.smtp_user, settings.smtp_password)
            srv.sendmail(settings.smtp_from, recipients, root.as_string())

    try:
        await asyncio.to_thread(_send)
        return {
            "channel": "email",
            "result": "sent",
            "recipients": recipients,
            "logo_included": has_logo,
        }
    except Exception as e:
        return {"channel": "email", "result": "error", "detail": str(e)}

# ── Webhook Slack / Teams ─────────────────────────────────────────────────────

def _build_slack_payload(alert: dict) -> dict:
    meta = _get_meta(alert.get("severity", "info"))
    return {
        "text": f"*[{meta['label']}]* — {alert.get('title', 'Incident')}",
        "attachments": [{
            "color":    meta["color"],
            "fields": [
                {"title": "MITRE",       "value": f"{alert.get('mitre_tactic','N/A')} / {alert.get('mitre_technique','N/A')}", "short": True},
                {"title": "Source IP",   "value": alert.get("source_ip") or "—",     "short": True},
                {"title": "Cible",       "value": alert.get("target_host") or "—",   "short": True},
                {"title": "Utilisateur", "value": alert.get("username") or "—",      "short": True},
                {"title": "Confiance",   "value": f"{int((alert.get('confidence') or 0) * 100)}%", "short": True},
                {"title": "ID",          "value": alert.get("alert_id") or "—",      "short": True},
            ],
            "footer": "Smart SIEM CTU",
        }],
    }


def _build_teams_payload(alert: dict) -> dict:
    meta = _get_meta(alert.get("severity", "info"))
    return {
        "@type":      "MessageCard",
        "@context":   "http://schema.org/extensions",
        "themeColor": meta["color"].replace("#", ""),
        "summary":    f"Alerte {meta['label']} — {alert.get('title')}",
        "sections": [{
            "activityTitle":    f"[{meta['label']}]",
            "activitySubtitle": alert.get("title", "Incident detecte"),
            "facts": [
                {"name": "MITRE",        "value": f"{alert.get('mitre_tactic','N/A')} / {alert.get('mitre_technique','N/A')}"},
                {"name": "Source IP",    "value": alert.get("source_ip") or "—"},
                {"name": "Cible",        "value": alert.get("target_host") or "—"},
                {"name": "Confiance",    "value": f"{int((alert.get('confidence') or 0) * 100)}%"},
                {"name": "Description",  "value": (alert.get("description") or "—")[:150]},
            ],
        }],
    }


async def send_webhook_alert(alert: dict) -> dict:
    """Envoie vers Slack ou Teams selon l'URL configuree."""
    if not settings.webhook_configured:
        return {"channel": "webhook", "result": "skipped", "reason": "webhook_url_not_configured"}

    url = settings.webhook_url
    if "outlook.office.com" in url or "webhook.office.com" in url:
        payload = _build_teams_payload(alert)
    else:
        payload = _build_slack_payload(alert)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            return {
                "channel":     "webhook",
                "result":      "sent" if resp.status_code < 300 else "error",
                "status_code": resp.status_code,
            }
    except Exception as e:
        return {"channel": "webhook", "result": "error", "detail": str(e)}


# ── SMS Twilio (optionnel) ────────────────────────────────────────────────────

async def send_sms_alert(alert: dict) -> dict:
    """Envoie un SMS via Twilio — uniquement pour les alertes CRITICAL."""
    if not settings.sms_configured:
        return {"channel": "sms", "result": "skipped", "reason": "twilio_not_configured"}
    if alert.get("severity", "").lower() != "critical":
        return {"channel": "sms", "result": "skipped", "reason": "sms_only_for_critical"}

    meta = _get_meta(alert.get("severity", "critical"))
    body = (
        f"[Smart SIEM] [{meta['label']}]\n"
        f"{alert.get('title', 'Incident')[:60]}\n"
        f"IP: {alert.get('source_ip') or 'inconnue'}\n"
        f"ID: {alert.get('alert_id') or '—'}"
    )

    def _send():
        try:
            from twilio.rest import Client
            client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
            msg = client.messages.create(
                body=body,
                from_=settings.twilio_from_number,
                to=settings.twilio_to_number,
            )
            return {"sid": msg.sid, "status": msg.status}
        except ImportError:
            return {"error": "twilio non installe — pip install twilio"}

    try:
        result = await asyncio.to_thread(_send)
        return {"channel": "sms", "result": "sent", **result}
    except Exception as e:
        return {"channel": "sms", "result": "error", "detail": str(e)}


# ── Pipeline multicanal ───────────────────────────────────────────────────────

async def notify_all(alert: dict) -> dict:
    """Envoie sur tous les canaux configures en parallele. Retourne un rapport par canal."""
    tasks = [
        send_email_alert(alert),
        send_webhook_alert(alert),
        send_sms_alert(alert),
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    channels = {}
    for r in results:
        if isinstance(r, Exception):
            channels[str(r)] = {"result": "exception", "detail": str(r)}
        elif isinstance(r, dict):
            channels[r.get("channel", "unknown")] = r
    return channels


async def notify_critical(alert: dict) -> dict:
    """Raccourci : notifie uniquement si CRITICAL ou WARNING."""
    sev = (alert.get("severity") or "").lower()
    if sev not in ("critical", "warning"):
        return {}
    return await notify_all(alert)