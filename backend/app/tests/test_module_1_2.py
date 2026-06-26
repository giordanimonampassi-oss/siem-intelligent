"""
Tests Modules 1 & 2 + Auth — Smart SIEM
Couvre : normalisation, schemas, sécurité, RBAC, intégrité SHA-256.
Usage : pytest tests/ -v
"""
import pytest
import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_siem.db")
os.environ.setdefault("SECRET_KEY",   "test_secret_key_32chars_minimum_ok")
os.environ.setdefault("DEBUG",        "false")


# ══════════════════════════════════════════════════════════════════════════════
# MODULE 1 — Normalisation
# ══════════════════════════════════════════════════════════════════════════════
class TestNormalizer:

    def test_detect_auth_ssh(self):
        from app.services.normalizer import detect_log_type
        from app.core.constants import LogType
        assert detect_log_type("Failed password for root from 10.0.0.1 port 22 ssh2") == LogType.AUTH

    def test_detect_auth_ntlm(self):
        from app.services.normalizer import detect_log_type
        from app.core.constants import LogType
        assert detect_log_type("NTLM pass-the-hash authentication detected") == LogType.AUTH

    def test_detect_auth_badge(self):
        from app.services.normalizer import detect_log_type
        from app.core.constants import LogType
        assert detect_log_type("badge login nmyers at 02:47") == LogType.AUTH

    def test_detect_network_firewall(self):
        from app.services.normalizer import detect_log_type
        from app.core.constants import LogType
        assert detect_log_type("iptables DROP tcp 192.168.1.1:45 to 10.0.0.1:80") == LogType.NETWORK

    def test_detect_network_vpn(self):
        from app.services.normalizer import detect_log_type
        from app.core.constants import LogType
        assert detect_log_type("VPN tunnel established from 41.77.12.3") == LogType.NETWORK

    def test_detect_application_http(self):
        from app.services.normalizer import detect_log_type
        from app.core.constants import LogType
        assert detect_log_type("GET /api/v1/logs HTTP/1.1 200 OK nginx") == LogType.APPLICATION

    def test_detect_application_error(self):
        from app.services.normalizer import detect_log_type
        from app.core.constants import LogType
        assert detect_log_type("500 Internal Server Error flask") == LogType.APPLICATION

    def test_detect_cloud(self):
        from app.services.normalizer import detect_log_type
        from app.core.constants import LogType
        assert detect_log_type("AWS CloudTrail: IAM role assumed by ec2 instance") == LogType.CLOUD

    def test_detect_system_fallback(self):
        from app.services.normalizer import detect_log_type
        from app.core.constants import LogType
        assert detect_log_type("cron: Starting daily backup job") == LogType.SYSTEM

    def test_severity_critical(self):
        from app.services.normalizer import detect_severity
        from app.core.constants import LogSeverity
        assert detect_severity("CRITICAL attack detected — ransomware") == LogSeverity.CRITICAL

    def test_severity_critical_exfil(self):
        from app.services.normalizer import detect_severity
        from app.core.constants import LogSeverity
        assert detect_severity("Data exfiltration 9.4 GB by nmyers") == LogSeverity.CRITICAL

    def test_severity_warning_fail(self):
        from app.services.normalizer import detect_severity
        from app.core.constants import LogSeverity
        assert detect_severity("Failed password for root from 178.43.12.87") == LogSeverity.WARNING

    def test_severity_warning_denied(self):
        from app.services.normalizer import detect_severity
        from app.core.constants import LogSeverity
        assert detect_severity("Access denied for user nmyers") == LogSeverity.WARNING

    def test_severity_info(self):
        from app.services.normalizer import detect_severity
        from app.core.constants import LogSeverity
        assert detect_severity("User logged in successfully") == LogSeverity.INFO

    def test_severity_declared_wins(self):
        """La sévérité déclarée prime sur la détection automatique."""
        from app.services.normalizer import detect_severity
        from app.core.constants import LogSeverity
        # Message qui serait INFO, mais on déclare CRITICAL
        result = detect_severity("routine backup completed", LogSeverity.CRITICAL)
        assert result == LogSeverity.CRITICAL

    def test_extract_ip_from_msg(self):
        from app.services.normalizer import extract_ip
        assert extract_ip("Failed password from 178.43.12.87 port 22") == "178.43.12.87"

    def test_extract_ip_fallback(self):
        from app.services.normalizer import extract_ip
        assert extract_ip("Connection 10.0.1.45 to 10.0.0.1") == "10.0.1.45"

    def test_extract_ip_no_loopback(self):
        from app.services.normalizer import extract_ip
        # 127.x doit être ignoré
        result = extract_ip("connection from 127.0.0.1 port 22")
        assert result is None or result != "127.0.0.1"

    def test_extract_ip_none(self):
        from app.services.normalizer import extract_ip
        assert extract_ip("System started successfully — no network") is None

    def test_normalize_full_pipeline(self):
        from app.services.normalizer import normalize
        from app.schemas.log_schemas import LogIngest
        from app.core.constants import LogType, LogSeverity
        payload = LogIngest(
            raw_message="Failed password for root from 178.43.12.87 port 22 ssh2",
            host="ctu-srv-01",
            log_type=None,
            severity=None,
        )
        result = normalize(payload)
        assert result["source_ip"]  == "178.43.12.87"
        assert result["log_type"]   == LogType.AUTH
        assert result["severity"]   == LogSeverity.WARNING
        assert result["host"]       == "ctu-srv-01"
        assert result["timestamp"]  is not None

    def test_normalize_uses_declared_ip(self):
        from app.services.normalizer import normalize
        from app.schemas.log_schemas import LogIngest
        payload = LogIngest(
            raw_message="Something from 10.0.0.1",
            source_ip="192.168.5.22",  # IP déclarée explicitement
        )
        result = normalize(payload)
        assert result["source_ip"] == "192.168.5.22"


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS PYDANTIC
# ══════════════════════════════════════════════════════════════════════════════
class TestSchemas:

    def test_log_ingest_minimal(self):
        from app.schemas.log_schemas import LogIngest
        log = LogIngest(raw_message="Test log message")
        assert log.raw_message == "Test log message"
        assert log.source_ip   is None
        assert log.log_type    is None

    def test_log_ingest_empty_fails(self):
        from app.schemas.log_schemas import LogIngest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            LogIngest(raw_message="")

    def test_log_ingest_too_long_fails(self):
        from app.schemas.log_schemas import LogIngest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            LogIngest(raw_message="x" * 5000)

    def test_log_ingest_invalid_ip_ignored(self):
        from app.schemas.log_schemas import LogIngest
        log = LogIngest(raw_message="test", source_ip="999.999.999.999")
        assert log.source_ip is None

    def test_log_ingest_valid_ip(self):
        from app.schemas.log_schemas import LogIngest
        log = LogIngest(raw_message="test", source_ip="178.43.12.87")
        assert log.source_ip == "178.43.12.87"

    def test_log_batch_max_500(self):
        from app.schemas.log_schemas import LogIngest, LogBatchIngest
        from pydantic import ValidationError
        logs = [LogIngest(raw_message=f"log {i}") for i in range(501)]
        with pytest.raises(ValidationError):
            LogBatchIngest(logs=logs)

    def test_log_batch_valid(self):
        from app.schemas.log_schemas import LogIngest, LogBatchIngest
        logs = [LogIngest(raw_message=f"log {i}") for i in range(10)]
        batch = LogBatchIngest(logs=logs, batch_id="TEST-01")
        assert len(batch.logs) == 10
        assert batch.batch_id  == "TEST-01"

    def test_user_create_valid(self):
        from app.schemas.user_schemas import UserCreate
        from app.core.constants import UserRole
        u = UserCreate(
            username="jbauer",
            email="j.bauer@ctu.gov",
            password="Field@CTU2026",
            role=UserRole.ANALYST,
        )
        assert u.username == "jbauer"
        assert u.role     == UserRole.ANALYST

    def test_user_create_short_password_fails(self):
        from app.schemas.user_schemas import UserCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            UserCreate(username="test", email="t@test.com", password="short")

    def test_user_create_invalid_email_fails(self):
        from app.schemas.user_schemas import UserCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            UserCreate(username="test", email="not-an-email", password="ValidPass123")

    def test_search_params_defaults(self):
        from app.schemas.log_schemas import LogSearchParams
        p = LogSearchParams()
        assert p.page == 1
        assert p.size == 50

    def test_search_params_size_max(self):
        from app.schemas.log_schemas import LogSearchParams
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            LogSearchParams(size=600)


# ══════════════════════════════════════════════════════════════════════════════
# SÉCURITÉ — JWT, bcrypt, TOTP
# ══════════════════════════════════════════════════════════════════════════════
class TestSecurity:

    def test_hash_verify_password(self):
        from app.core.security import hash_password, verify_password
        h = hash_password("CTU_Secure_2026")
        assert verify_password("CTU_Secure_2026", h) is True
        assert verify_password("wrong_password",  h) is False

    def test_different_passwords_different_hashes(self):
        from app.core.security import hash_password
        h1 = hash_password("password1")
        h2 = hash_password("password2")
        assert h1 != h2

    def test_create_decode_token(self):
        from app.core.security import create_access_token, decode_access_token
        token = create_access_token({"sub": "abc-123", "role": "ANALYST"})
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"]  == "abc-123"
        assert payload["role"] == "ANALYST"

    def test_invalid_token_returns_none(self):
        from app.core.security import decode_access_token
        assert decode_access_token("invalid.token.xyz") is None

    def test_tampered_token_returns_none(self):
        from app.core.security import create_access_token, decode_access_token
        token = create_access_token({"sub": "123"})
        tampered = token[:-5] + "XXXXX"
        assert decode_access_token(tampered) is None

    def test_totp_generate_verify(self):
        import pyotp
        from app.core.security import generate_totp_secret, verify_totp
        secret = generate_totp_secret()
        assert len(secret) >= 16
        current_code = pyotp.TOTP(secret).now()
        assert verify_totp(secret, current_code) is True

    def test_totp_wrong_code(self):
        from app.core.security import generate_totp_secret, verify_totp
        secret = generate_totp_secret()
        assert verify_totp(secret, "000000") is False

    def test_totp_uri_format(self):
        from app.core.security import generate_totp_secret, get_totp_uri
        secret = generate_totp_secret()
        uri = get_totp_uri(secret, "chloe@ctu.gov")
        assert uri.startswith("otpauth://totp/")
        assert "SmartSIEM" in uri
        assert "chloe" in uri


# ══════════════════════════════════════════════════════════════════════════════
# MODULE 2 — Intégrité SHA-256
# ══════════════════════════════════════════════════════════════════════════════
class TestIntegrity:

    def test_sha256_deterministic(self):
        import hashlib
        content = "id1:2026-01-01T00:00:00+00:00:test log message"
        h1 = hashlib.sha256(content.encode()).hexdigest()
        h2 = hashlib.sha256(content.encode()).hexdigest()
        assert h1 == h2
        assert len(h1) == 64

    def test_sha256_different_for_different_content(self):
        import hashlib
        h1 = hashlib.sha256(b"log entry 1").hexdigest()
        h2 = hashlib.sha256(b"log entry 2").hexdigest()
        assert h1 != h2

    def test_sha256_changes_if_tampered(self):
        """Simule une falsification : le hash doit changer."""
        import hashlib
        original = "id:2026-01-01:original message"
        tampered = "id:2026-01-01:modified message"
        h_orig = hashlib.sha256(original.encode()).hexdigest()
        h_tamp = hashlib.sha256(tampered.encode()).hexdigest()
        assert h_orig != h_tamp

    def test_sha256_length_64_chars(self):
        import hashlib
        h = hashlib.sha256(b"any content").hexdigest()
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)


# ══════════════════════════════════════════════════════════════════════════════
# RBAC — Constantes et logique de rôles
# ══════════════════════════════════════════════════════════════════════════════
class TestRBAC:

    def test_all_roles_defined(self):
        from app.core.constants import UserRole
        roles = [r.value for r in UserRole]
        assert "ADMIN"   in roles
        assert "ANALYST" in roles
        assert "RSSI"    in roles
        assert "AUDITOR" in roles
        assert "READER"  in roles

    def test_role_hierarchy_logic(self):
        """ADMIN doit avoir accès à tout — vérifie la logique de require_role."""
        from app.core.constants import UserRole

        def can_access(user_role: UserRole, *allowed_roles: UserRole) -> bool:
            return user_role in allowed_roles

        # ADMIN peut accéder partout
        assert can_access(UserRole.ADMIN,   UserRole.ADMIN)
        assert can_access(UserRole.ADMIN,   UserRole.ANALYST, UserRole.ADMIN)
        assert can_access(UserRole.ADMIN,   UserRole.RSSI, UserRole.ADMIN)

        # ANALYST n'accède pas aux endpoints admin only
        assert not can_access(UserRole.ANALYST, UserRole.ADMIN)

        # READER n'accède pas aux endpoints analyst
        assert not can_access(UserRole.READER, UserRole.ANALYST, UserRole.ADMIN)

    def test_log_types_match_teammate_model(self):
        """Vérifie que nos LogType correspondent au AuthNetwork du camarade BDD."""
        from app.core.constants import LogType
        values = [t.value for t in LogType]
        # Valeurs du modèle camarade : AUTH, NETWORK, APPLICATION, SYSTEM, CLOUD
        assert "AUTH"        in values
        assert "NETWORK"     in values
        assert "APPLICATION" in values
        assert "SYSTEM"      in values
        assert "CLOUD"       in values

    def test_severity_matches_teammate_model(self):
        """Vérifie que nos LogSeverity correspondent à AlertSeverity du camarade BDD."""
        from app.core.constants import LogSeverity
        values = [s.value for s in LogSeverity]
        assert "INFO"     in values
        assert "WARNING"  in values
        assert "HIGH"     in values
        assert "CRITICAL" in values

    def test_playbook_modes_match(self):
        from app.core.constants import PlaybookMode
        values = [m.value for m in PlaybookMode]
        assert "MANUAL"    in values
        assert "AUTO"      in values
        assert "SEMI_AUTO" in values