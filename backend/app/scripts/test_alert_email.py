"""
Test end-to-end : cree une alerte CRITICAL en base, declenche
trigger_auto_playbooks() comme le ferait le moteur de correlation, et
verifie que l'email part reellement via le playbook 'escalate'.

Usage : python -m scripts.test_alert_email
"""
import asyncio
import uuid
import sys
from datetime import datetime, timezone

from db.database import AsyncSessionLocal
from models.alert import Alert
from services.soar import trigger_auto_playbooks
from core.constants import AlertSeverity, AlertStatus

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

async def main():
    async with AsyncSessionLocal() as db:
        alert = Alert(
            id=uuid.uuid4(),
            alert_id=f"TEST-EMAIL-{uuid.uuid4().hex[:8]}",
            severity=AlertSeverity.CRITICAL.value,
            status=AlertStatus.NEW.value,
            title="Test d'envoi d'email — alerte simulee",
            description="Alerte generee par scripts/test_alert_email.py pour verifier le pipeline complet.",
            source_ip="178.43.12.87",
            username="nina.myers",
            mitre_tactic="Exfiltration",
            mitre_technique="T1041",
            confidence=0.9,
            triggered_at=datetime.now(timezone.utc),
        )
        db.add(alert)
        await db.commit()
        await db.refresh(alert)
        print(f"Alerte creee : {alert.alert_id} (severity={alert.severity})")

        executions = await trigger_auto_playbooks(alert, db)
        print(f"\n{len(executions)} playbook(s) declenche(s) :")
        for e in executions:
            print(f"  - {e.playbook} [{e.mode}] -> status={e.status}")
            if e.detail:
                print(f"    detail: {e.detail}")

        escalate_ran = any(e.playbook == "escalate" and e.status == "completed" for e in executions)
        if escalate_ran:
            print("\n✅ Le playbook 'escalate' s'est execute — verifie ta boite mail.")
        else:
            print("\n⚠️  Aucun playbook 'escalate' termine detecte — verifie les imports dans soar.py "
                  "(AlertSeverity, send_email_alert) et les logs ci-dessus.")


if __name__ == "__main__":
    asyncio.run(main())