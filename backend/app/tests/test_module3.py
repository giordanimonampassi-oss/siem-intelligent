"""
Tests Module 3 — Correlation, Alertes, SOAR.
Usage : pytest tests/test_module3.py -v
"""
import pytest
import os
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_m3.db")
os.environ.setdefault("SECRET_KEY",   "test_secret_module3_32chars_min")
os.environ.setdefault("DEBUG",        "false")


# ══════════════════════════════════════════════════════════════════════════════
# MOTEUR DE CORRELATION
# ══════════════════════════════════════════════════════════════════════════════
class TestCorrelator:

    def _make_log(self, **kwargs):
        """Cree un LogEntry mock sans BDD."""
        from unittest.mock import MagicMock
        from datetime import datetime, timezone
        log = MagicMock()
        log.id         = "test-id"
        log.timestamp  = datetime.now(timezone.utc)
        log.source_ip  = kwargs.get("source_ip",  "178.43.12.87")
        log.dest_ip    = kwargs.get("dest_ip",     None)
        log.host       = kwargs.get("host",        "ctu-srv-01")
        log.username   = kwargs.get("username",    "root")
        log.log_type   = kwargs.get("log_type",    "AUTH")
        log.severity   = kwargs.get("severity",    "WARNING")
        log.raw_message= kwargs.get("raw_message", "Failed password for root from 178.43.12.87")
        return log

    def _make_rule(self, **kwargs):
        from unittest.mock import MagicMock
        rule = MagicMock()
        rule.id               = "rule-001"
        rule.name             = kwargs.get("name",           "Test Rule")
        rule.rule_type        = kwargs.get("rule_type",      "THRESHOLD")
        rule.log_type_filter  = kwargs.get("log_type_filter", None)
        rule.event_field      = kwargs.get("event_field",    "source_ip")
        rule.threshold        = kwargs.get("threshold",      3)
        rule.time_window      = kwargs.get("time_window",    60)
        rule.time_window_sec  = kwargs.get("time_window",    60)
        rule.window_seconds   = kwargs.get("time_window",    60)
        rule.alert_level      = kwargs.get("alert_level",    "WARNING")
        rule.confidence_score = kwargs.get("confidence",     0.8)
        rule.mitre_tactic     = kwargs.get("mitre_tactic",   "TA0001")
        rule.mitre_technique  = kwargs.get("mitre_technique","T1110")
        rule.pattern_sequence = kwargs.get("pattern_sequence", None)
        rule.target_keyword   = kwargs.get("target_keyword", None)
        rule.is_active        = True
        return rule

    @pytest.mark.asyncio
    async def test_threshold_not_triggered_below(self):
        """Regle threshold : pas d'alerte sous le seuil."""
        from services.correlator import evaluate_rules, _event_windows
        _event_windows.clear()
        log  = self._make_log()
        rule = self._make_rule(threshold=5)
        # Envoyer 4 logs (seuil=5 → pas d'alerte)
        for _ in range(4):
            result = await evaluate_rules(log, [rule])
        assert result == []

    @pytest.mark.asyncio
    async def test_threshold_triggered_at_threshold(self):
        """Regle threshold : alerte declenchee exactement au seuil."""
        from services.correlator import evaluate_rules, _event_windows, _dedup_cache
        _event_windows.clear()
        _dedup_cache.clear()
        log  = self._make_log(source_ip="99.99.99.99")
        rule = self._make_rule(threshold=3, name="Brute Force Test")
        result = []
        for _ in range(3):
            result = await evaluate_rules(log, [rule])
        assert len(result) == 1
        assert result[0]["severity"] == "WARNING"

    @pytest.mark.asyncio
    async def test_threshold_deduplication(self):
        """Meme alerte dans les 5 min → pas de doublon."""
        from services.correlator import evaluate_rules, _event_windows, _dedup_cache
        _event_windows.clear()
        _dedup_cache.clear()
        log  = self._make_log(source_ip="55.55.55.55")
        rule = self._make_rule(threshold=2, name="Dedup Test")
        # Atteindre le seuil
        for _ in range(2):
            await evaluate_rules(log, [rule])
        # Envoyer 10 logs de plus → pas de nouvelle alerte (dedup)
        results = []
        for _ in range(10):
            results = await evaluate_rules(log, [rule])
        assert results == []

    @pytest.mark.asyncio
    async def test_anomaly_keyword_match(self):
        """Regle ANOMALY : mot-cle trouve dans raw_message."""
        from services.correlator import evaluate_rules, _event_windows, _dedup_cache
        _event_windows.clear()
        _dedup_cache.clear()
        log  = self._make_log(
            raw_message="Data transfer 9.4 gb in 12min by nmyers exceeded threshold",
            source_ip="77.77.77.77",
        )
        rule = self._make_rule(
            rule_type="ANOMALY",
            target_keyword="9.4 gb",
            alert_level="CRITICAL",
            name="Exfil Test",
        )
        result = await evaluate_rules(log, [rule])
        assert len(result) == 1
        assert result[0]["severity"] == "CRITICAL"

    @pytest.mark.asyncio
    async def test_anomaly_no_keyword_match(self):
        """Regle ANOMALY : mot-cle absent → pas d'alerte."""
        from services.correlator import evaluate_rules, _event_windows, _dedup_cache
        _event_windows.clear()
        _dedup_cache.clear()
        log  = self._make_log(raw_message="Normal login by user", source_ip="88.88.88.88")
        rule = self._make_rule(rule_type="ANOMALY", target_keyword="malware", name="Test No Match")
        result = await evaluate_rules(log, [rule])
        assert result == []

    @pytest.mark.asyncio
    async def test_log_type_filter(self):
        """Regle avec filtre type : log de mauvais type → pas d'alerte."""
        from services.correlator import evaluate_rules, _event_windows, _dedup_cache
        _event_windows.clear()
        _dedup_cache.clear()
        log  = self._make_log(log_type="NETWORK", source_ip="11.22.33.44")
        rule = self._make_rule(
            log_type_filter="AUTH",
            threshold=1,
            name="Auth Only Rule",
        )
        result = await evaluate_rules(log, [rule])
        assert result == []

    @pytest.mark.asyncio
    async def test_inactive_rule_ignored(self):
        """Regle inactive → jamais evaluee."""
        from services.correlator import evaluate_rules
        log  = self._make_log(source_ip="22.33.44.55")
        rule = self._make_rule(threshold=1, name="Inactive")
        rule.is_active = False
        for _ in range(5):
            result = await evaluate_rules(log, [rule])
        assert result == []

    @pytest.mark.asyncio
    async def test_ueba_score_upgrades_level(self):
        """Score UEBA > 50 rehausse le niveau d'alerte d'un cran."""
        from services.correlator import _upgrade_level
        from core.constants import LogSeverity
        result = _upgrade_level(LogSeverity.WARNING, ueba_score=75.0)
        assert result == LogSeverity.CRITICAL

    @pytest.mark.asyncio
    async def test_ueba_score_below_threshold_no_upgrade(self):
        """Score UEBA < 50 → pas de rehaussement."""
        from services.correlator import _upgrade_level
        from core.constants import LogSeverity
        result = _upgrade_level(LogSeverity.WARNING, ueba_score=30.0)
        assert result == LogSeverity.WARNING

    @pytest.mark.asyncio
    async def test_critical_not_upgraded(self):
        """CRITICAL ne peut pas etre rehausse (deja au max)."""
        from services.correlator import _upgrade_level
        from core.constants import LogSeverity
        result = _upgrade_level(LogSeverity.CRITICAL, ueba_score=99.0)
        assert result == LogSeverity.CRITICAL

    @pytest.mark.asyncio
    async def test_alert_dict_structure(self):
        """Dict d'alerte contient tous les champs requis."""
        from services.correlator import evaluate_rules, _event_windows, _dedup_cache
        _event_windows.clear()
        _dedup_cache.clear()
        log  = self._make_log(source_ip="44.55.66.77")
        rule = self._make_rule(threshold=1, name="Struct Test")
        result = await evaluate_rules(log, [rule])
        assert len(result) == 1
        alert = result[0]
        for field in ["alert_id","title","description","severity","source_ip","confidence","status"]:
            assert field in alert, f"Champ manquant: {field}"

    def test_alert_id_format(self):
        """alert_id doit commencer par AL-."""
        from services.correlator import _make_alert_id
        aid = _make_alert_id()
        assert aid.startswith("AL-")
        assert len(aid) == 11  # "AL-" + 8 chars


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS ALERTES
# ══════════════════════════════════════════════════════════════════════════════
class TestAlertSchemas:

    def test_rule_create_valid(self):
        from schemas.alert_schemas import RuleCreate
        from core.constants import RuleType, LogSeverity
        rule = RuleCreate(
            name="Brute Force SSH",
            rule_type=RuleType.THRESHOLD,
            threshold=5,
            time_window_sec=60,
            alert_level=LogSeverity.CRITICAL,
        )
        assert rule.name == "Brute Force SSH"
        assert rule.threshold == 5

    def test_rule_create_name_too_short(self):
        from schemas.alert_schemas import RuleCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            RuleCreate(name="AB")

    def test_rule_create_confidence_bounds(self):
        from schemas.alert_schemas import RuleCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            RuleCreate(name="Test Rule", confidence_score=1.5)

    def test_rule_update_partial(self):
        from schemas.alert_schemas import RuleUpdate
        upd = RuleUpdate(threshold=10)
        d = upd.model_dump(exclude_none=True)
        assert "threshold" in d
        assert "name" not in d

    def test_alert_response_model(self):
        import uuid
        from datetime import datetime, timezone
        from schemas.alert_schemas import AlertResponse
        data = {
            "id":           uuid.uuid4(),
            "alert_id":     "AL-ABCD1234",
            "severity":     "CRITICAL",
            "status":       "NEW",
            "title":        "Test Alert",
            "description":  "Test",
            "source_ip":    "1.2.3.4",
            "target_host":  "host",
            "username":     None,
            "confidence":   0.9,
            "ueba_score":   None,
            "mitre_tactic": "TA0001",
            "mitre_technique":"T1110",
            "triggered_at": datetime.now(timezone.utc),
            "resolved_at":  None,
            "acknowledged_at":None,
        }
        alert = AlertResponse(**data)
        assert alert.severity == "CRITICAL"


# ══════════════════════════════════════════════════════════════════════════════
# SOAR
# ══════════════════════════════════════════════════════════════════════════════
class TestSoar:

    @pytest.mark.asyncio
    async def test_block_ip_returns_dict(self):
        from services.soar import _block_ip
        result = await _block_ip("1.2.3.4")
        assert result["action"] == "block_ip"
        assert result["ip"]     == "1.2.3.4"
        assert result["result"] == "blocked"

    @pytest.mark.asyncio
    async def test_disable_account_returns_dict(self):
        from services.soar import _disable_account
        result = await _disable_account("nmyers")
        assert result["action"]   == "disable_account"
        assert result["username"] == "nmyers"
        assert result["result"]   == "disabled"

    @pytest.mark.asyncio
    async def test_webhook_skipped_without_url(self):
        from unittest.mock import MagicMock, patch
        from services.soar import _send_webhook
        alert = MagicMock()
        alert.severity    = "CRITICAL"
        alert.title       = "Test"
        alert.source_ip   = "1.2.3.4"
        alert.target_host = "host"
        alert.username    = "user"
        alert.confidence  = 0.9
        alert.triggered_at = None
        alert.alert_id    = "AL-TEST001"
        alert.mitre_tactic    = "TA0001"
        alert.mitre_technique = "T1110"
        alert.description = "test"

        with patch("services.soar.settings") as mock_settings:
            mock_settings.webhook_url = ""
            result = await _send_webhook(alert)
        assert result["result"] == "skipped"

    @pytest.mark.asyncio
    async def test_email_skipped_without_smtp(self):
        from unittest.mock import MagicMock, patch
        from services.soar import _send_email
        alert = MagicMock()
        alert.severity        = "HIGH"
        alert.title           = "Test Email"
        alert.source_ip       = "5.6.7.8"
        alert.target_host     = "host"
        alert.username        = None
        alert.confidence      = 0.75
        alert.triggered_at    = None
        alert.alert_id        = "AL-TEST002"
        alert.mitre_tactic    = "TA0008"
        alert.mitre_technique = "T1550"
        alert.description     = "test"

        with patch("services.soar.settings") as mock_settings:
            mock_settings.smtp_user     = ""
            mock_settings.smtp_password = ""
            result = await _send_email(alert)
        assert result["result"] == "skipped"


# ══════════════════════════════════════════════════════════════════════════════
# SEED REGLES MITRE
# ══════════════════════════════════════════════════════════════════════════════
class TestMitreRules:

    def test_seed_has_5_rules(self):
        from services.rule_service import MITRE_RULES_SEED
        assert len(MITRE_RULES_SEED) == 5

    def test_all_rules_have_mitre_fields(self):
        from services.rule_service import MITRE_RULES_SEED
        for rule in MITRE_RULES_SEED:
            assert "mitre_tactic"    in rule
            assert "mitre_technique" in rule
            assert rule["mitre_tactic"].startswith("TA")
            assert rule["mitre_technique"].startswith("T")

    def test_all_rules_active_by_default(self):
        from services.rule_service import MITRE_RULES_SEED
        assert all(r["is_active"] for r in MITRE_RULES_SEED)

    def test_severity_distribution(self):
        from services.rule_service import MITRE_RULES_SEED
        from core.constants import LogSeverity
        levels = [r["alert_level"] for r in MITRE_RULES_SEED]
        assert LogSeverity.CRITICAL.value in levels
        assert LogSeverity.INFO.value     in levels
        assert LogSeverity.WARNING.value  in levels

    def test_required_tactics_covered(self):
        """Les 4 tactiques MITRE obligatoires du cahier des charges."""
        from services.rule_service import MITRE_RULES_SEED
        tactics = {r["mitre_tactic"] for r in MITRE_RULES_SEED}
        for required in ["TA0001", "TA0008", "TA0010", "TA0005"]:
            assert required in tactics, f"Tactique manquante: {required}"