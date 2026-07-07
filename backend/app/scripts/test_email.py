"""
Script de test isole pour l'envoi d'email — a lancer depuis backend/app.
Usage : python -m scripts.test_email
"""
import asyncio
import sys

# Windows : meme correctif que pour seed_ueba_dataset.py
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from services.notifier import send_email_alert


async def main():
    fake_alert = {
        "alert_id": "TEST-0001",
        "severity": "CRITICAL",
        "title": "Test d'envoi email — Smart SIEM",
        "description": "Ceci est un test manuel de la configuration SMTP.",
        "source_ip": "178.43.12.87",
        "target_host": "test-host-01",
        "username": "test.user",
        "confidence": 0.95,
        "mitre_tactic": "TA0001 - Initial Access",
        "mitre_technique": "T1110",
        "triggered_at": "2026-07-06T10:00:00+00:00",
    }

    result = await send_email_alert(fake_alert)
    print("Résultat :", result)

    if result.get("result") == "sent":
        print("✅ Email envoyé avec succès à :", result.get("recipients"))
    elif result.get("reason") == "smtp_not_configured":
        print("❌ SMTP non configuré — vérifiez smtp_user/smtp_password dans .env")
    else:
        print("❌ Échec :", result.get("detail"))


if __name__ == "__main__":
    asyncio.run(main())