"""
Moteur de correlation — Module 3.
Evalue les regles actives sur chaque log entrant.
Fenetres glissantes en memoire + deduplication 5 min.
Compatibilite totale avec le correlator.py existant du projet.
"""
import uuid
import json
from datetime import datetime, timedelta, timezone
from collections import defaultdict, deque
from typing import List, Dict, Optional, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.constants import LogSeverity, AlertSeverity, UEBA_RISK_THRESHOLD_CORREL, DEDUP_WINDOW_SEC
from models.alert import CorrelationRule, Alert
from models.log_entry import LogEntry


# ─── Cache en memoire ─────────────────────────────────────────────────────────
# { rule_id: { context_key: deque([datetime, ...]) } }
_event_windows: Dict[str, Dict[str, deque]] = defaultdict(lambda: defaultdict(deque))

# Cache deduplication : { dedup_key: last_alert_time }
_dedup_cache: Dict[str, datetime] = {}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _context_key(log: LogEntry, rule: CorrelationRule) -> str:
    """Cle de contexte pour la fenetre glissante (par IP source par defaut)."""
    field = rule.event_field or "source_ip"
    value = getattr(log, field, None) or "unknown"
    return f"{rule.id}:{value}"


def _clean_window(window: deque, now: datetime, window_sec: int) -> None:
    """Supprime les evenements expires."""
    cutoff = now - timedelta(seconds=window_sec)
    while window and window[0] < cutoff:
        window.popleft()


def _is_duplicate(dedup_key: str, now: datetime) -> bool:
    """Alerte identique emise il y a moins de DEDUP_WINDOW_SEC ?"""
    last = _dedup_cache.get(dedup_key)
    if last and (now - last).total_seconds() < DEDUP_WINDOW_SEC:
        return True
    return False


def _upgrade_level(level: LogSeverity, ueba_score: Optional[float]) -> LogSeverity:
    """
    Rehausse le niveau d'alerte si score UEBA > seuil (EF-UEB-05).
    INFO -> WARNING -> CRITICAL
    """
    if ueba_score and ueba_score > UEBA_RISK_THRESHOLD_CORREL:
        order = [LogSeverity.INFO, LogSeverity.WARNING, LogSeverity.CRITICAL]
        try:
            idx = order.index(level)
            if idx < len(order) - 1:
                return order[idx + 1]
        except ValueError:
            pass
    return level


def _make_alert_id() -> str:
    """Genere un identifiant unique d'alerte type AL-XXXXXXXX."""
    return f"AL-{str(uuid.uuid4())[:8].upper()}"


# ─── Evaluation des regles ────────────────────────────────────────────────────

async def evaluate_rules(
    log: LogEntry,
    rules: List[CorrelationRule],
    ueba_score: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """
    Evalue toutes les regles actives sur un log entrant.
    Retourne la liste des dicts d'alerte a persister.
    """
    triggered = []
    now = log.timestamp or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    for rule in rules:
        if not rule.is_active:
            continue

        # Filtre type de log
        if rule.log_type_filter and log.log_type != rule.log_type_filter:
            continue

        ctx_key = _context_key(log, rule)
        window  = _event_windows[str(rule.id)][ctx_key]
        tw      = rule.time_window  # propriete qui merge time_window_sec et window_seconds

        _clean_window(window, now, tw)
        window.append(now)

        # ── Regle THRESHOLD ───────────────────────────────────────────────────
        if rule.rule_type == "THRESHOLD" and rule.threshold:
            if len(window) >= rule.threshold:
                dedup_key = f"thr:{rule.id}:{ctx_key}"
                if not _is_duplicate(dedup_key, now):
                    level = _upgrade_level(
                        LogSeverity(rule.alert_level) if rule.alert_level else LogSeverity.WARNING,
                        ueba_score,
                    )
                    triggered.append({
                        "alert_id":       _make_alert_id(),
                        "rule_id":        rule.id,
                        "title":          f"{rule.name} — {log.source_ip or log.host or 'inconnu'}",
                        "description":    (
                            f"{len(window)} evenement(s) en {tw}s "
                            f"depuis {log.source_ip or 'source inconnue'} "
                            f"(seuil: {rule.threshold})"
                        ),
                        "severity":       level.value,
                        "source_ip":      log.source_ip,
                        "target_host":    log.host,
                        "username":       log.username,
                        "confidence":     rule.confidence_score or 0.8,
                        "mitre_tactic":   rule.mitre_tactic,
                        "mitre_technique":rule.mitre_technique,
                        "ueba_score":     ueba_score,
                        "status":         "NEW",
                        "triggered_at":   now,
                    })
                    _dedup_cache[dedup_key] = now

        # ── Regle SEQUENCE / PATTERN ──────────────────────────────────────────
        elif rule.rule_type in ("SEQUENCE", "THRESHOLD") and rule.pattern_sequence:
            try:
                pattern       = json.loads(rule.pattern_sequence)
                required_types = set(pattern.get("event_types", []))
                if required_types and log.log_type in required_types:
                    dedup_key = f"pat:{rule.id}:{ctx_key}"
                    if not _is_duplicate(dedup_key, now):
                        level = _upgrade_level(
                            LogSeverity(rule.alert_level) if rule.alert_level else LogSeverity.CRITICAL,
                            ueba_score,
                        )
                        triggered.append({
                            "alert_id":       _make_alert_id(),
                            "rule_id":        rule.id,
                            "title":          f"[Sequence] {rule.name}",
                            "description":    f"Sequence detectee sur {log.source_ip or log.host}",
                            "severity":       level.value,
                            "source_ip":      log.source_ip,
                            "target_host":    log.host,
                            "username":       log.username,
                            "confidence":     rule.confidence_score or 0.75,
                            "mitre_tactic":   rule.mitre_tactic,
                            "mitre_technique":rule.mitre_technique,
                            "ueba_score":     ueba_score,
                            "status":         "NEW",
                            "triggered_at":   now,
                        })
                        _dedup_cache[dedup_key] = now
            except (json.JSONDecodeError, KeyError, AttributeError):
                pass

        # ── Regle ANOMALY (mot-cle dans raw_message) ──────────────────────────
        elif rule.rule_type == "ANOMALY" and rule.target_keyword:
            if rule.target_keyword.lower() in (log.raw_message or "").lower():
                dedup_key = f"ano:{rule.id}:{ctx_key}"
                if not _is_duplicate(dedup_key, now):
                    level = _upgrade_level(
                        LogSeverity(rule.alert_level) if rule.alert_level else LogSeverity.CRITICAL,
                        ueba_score,
                    )
                    triggered.append({
                        "alert_id":       _make_alert_id(),
                        "rule_id":        rule.id,
                        "title":          f"[Anomalie] {rule.name}",
                        "description":    f"Mot-cle '{rule.target_keyword}' detecte : {(log.raw_message or '')[:120]}",
                        "severity":       level.value,
                        "source_ip":      log.source_ip,
                        "target_host":    log.host,
                        "username":       log.username,
                        "confidence":     rule.confidence_score or 0.7,
                        "mitre_tactic":   rule.mitre_tactic,
                        "mitre_technique":rule.mitre_technique,
                        "ueba_score":     ueba_score,
                        "status":         "NEW",
                        "triggered_at":   now,
                    })
                    _dedup_cache[dedup_key] = now

    return triggered


# ─── Chargement des regles ────────────────────────────────────────────────────

async def get_active_rules(db: AsyncSession) -> List[CorrelationRule]:
    result = await db.execute(
        select(CorrelationRule).where(CorrelationRule.is_active == True)
    )
    return result.scalars().all()


# ─── Pipeline complet : log -> evaluation -> persistance alertes ──────────────

async def process_log_for_alerts(
    log: LogEntry,
    db: AsyncSession,
    ueba_score: Optional[float] = None,
) -> List[Alert]:
    """
    Pipeline complet :
    1. Charge les regles actives
    2. Evalue sur le log
    3. Persiste les alertes declenchees
    4. Met a jour le compteur de la regle
    """
    rules = await get_active_rules(db)
    if not rules:
        return []

    alert_dicts = await evaluate_rules(log, rules, ueba_score)
    created_alerts = []

    for ad in alert_dicts:
        rule_id = ad.pop("rule_id", None)
        alert = Alert(rule_id=rule_id, **ad)
        db.add(alert)

        # Mettre a jour le compteur et last_triggered_at de la regle
        if rule_id:
            result = await db.execute(
                select(CorrelationRule).where(CorrelationRule.id == rule_id)
            )
            rule = result.scalar_one_or_none()
            if rule:
                rule.trigger_count    = (rule.trigger_count or 0) + 1
                rule.last_triggered_at = datetime.now(timezone.utc)

        created_alerts.append(alert)

    if created_alerts:
        await db.flush()
        await db.commit()
        for a in created_alerts:
            await db.refresh(a)

    return created_alerts