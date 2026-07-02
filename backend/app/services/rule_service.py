"""
Service Regles de correlation — Module 3.
CRUD complet + seed des 5 regles MITRE ATT&CK obligatoires.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from models.alert import CorrelationRule
from core.constants import RuleType, LogSeverity


# ─── CRUD ─────────────────────────────────────────────────────────────────────

async def list_rules(
    db: AsyncSession,
    active_only: bool = False,
) -> List[CorrelationRule]:
    q = select(CorrelationRule)
    if active_only:
        q = q.where(CorrelationRule.is_active == True)
    result = await db.execute(q.order_by(CorrelationRule.created_at.desc()))
    return result.scalars().all()


async def get_rule(rule_id: uuid.UUID, db: AsyncSession) -> Optional[CorrelationRule]:
    result = await db.execute(
        select(CorrelationRule).where(CorrelationRule.id == rule_id)
    )
    return result.scalar_one_or_none()


async def create_rule(payload: dict, db: AsyncSession) -> CorrelationRule:
    rule = CorrelationRule(**payload)
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


async def update_rule(
    rule: CorrelationRule,
    payload: dict,
    db: AsyncSession,
) -> CorrelationRule:
    for k, v in payload.items():
        if hasattr(rule, k) and v is not None:
            setattr(rule, k, v)
    await db.commit()
    await db.refresh(rule)
    return rule


async def toggle_rule(rule: CorrelationRule, db: AsyncSession) -> CorrelationRule:
    rule.is_active = not rule.is_active
    await db.commit()
    await db.refresh(rule)
    return rule


async def delete_rule(rule: CorrelationRule, db: AsyncSession) -> None:
    await db.delete(rule)
    await db.commit()


# ─── Seed des 5 regles MITRE ATT&CK obligatoires ─────────────────────────────

MITRE_RULES_SEED = [
    {
        "name":            "Brute Force SSH — TA0001/T1110",
        "description":     "5 echecs d'authentification en 60s depuis la meme IP (T1110 Brute Force)",
        "rule_type":       RuleType.THRESHOLD.value,
        "mitre_tactic":    "TA0001",
        "mitre_technique": "T1110",
        "log_type_filter": "AUTH",
        "event_field":     "source_ip",
        "threshold":       5,
        "time_window_sec": 60,
        "alert_level":     LogSeverity.CRITICAL.value,
        "confidence_score":0.92,
        "is_active":       True,
    },
    {
        "name":            "Mouvement lateral — TA0008/T1550",
        "description":     "Authentification NTLM inhabituelle entre 2 postes internes (Pass-the-Hash)",
        "rule_type":       RuleType.ANOMALY.value,
        "mitre_tactic":    "TA0008",
        "mitre_technique": "T1550",
        "log_type_filter": "AUTH",
        "target_keyword":  "ntlm",
        "alert_level":     LogSeverity.WARNING.value,
        "confidence_score":0.78,
        "is_active":       True,
    },
    {
        "name":            "Exfiltration donnees — TA0010/T1041",
        "description":     "Volume de donnees sortant > baseline sur 15 min (T1041 Exfiltration Over C2)",
        "rule_type":       RuleType.ANOMALY.value,
        "mitre_tactic":    "TA0010",
        "mitre_technique": "T1041",
        "log_type_filter": "APPLICATION",
        "target_keyword":  "9.4 gb",
        "alert_level":     LogSeverity.CRITICAL.value,
        "confidence_score":0.85,
        "is_active":       True,
    },
    {
        "name":            "Suppression journaux — TA0005/T1070",
        "description":     "Arret du service de journalisation sur un endpoint (T1070 Indicator Removal)",
        "rule_type":       RuleType.ANOMALY.value,
        "mitre_tactic":    "TA0005",
        "mitre_technique": "T1070",
        "log_type_filter": "SYSTEM",
        "target_keyword":  "log deletion",
        "alert_level":     LogSeverity.WARNING.value,
        "confidence_score":0.70,
        "is_active":       True,
    },
    {
        "name":            "Reconnaissance reseau — TA0043/T1046",
        "description":     "Scan de ports detecte depuis une IP externe (T1046 Network Service Discovery)",
        "rule_type":       RuleType.THRESHOLD.value,
        "mitre_tactic":    "TA0043",
        "mitre_technique": "T1046",
        "log_type_filter": "NETWORK",
        "event_field":     "source_ip",
        "threshold":       3,
        "time_window_sec": 30,
        "alert_level":     LogSeverity.WARNING.value,
        "confidence_score":0.65,
        "is_active":       True,
    },
]


async def seed_mitre_rules(db: AsyncSession) -> int:
    """
    Cree les 5 regles MITRE ATT&CK si elles n'existent pas deja.
    Retourne le nombre de regles crees.
    """
    count = (await db.execute(select(func.count(CorrelationRule.id)))).scalar_one()
    if count >= len(MITRE_RULES_SEED):
        return 0

    created = 0
    for rule_data in MITRE_RULES_SEED:
        existing = await db.execute(
            select(CorrelationRule).where(CorrelationRule.name == rule_data["name"])
        )
        if not existing.scalar_one_or_none():
            db.add(CorrelationRule(**rule_data))
            created += 1

    await db.commit()
    return created