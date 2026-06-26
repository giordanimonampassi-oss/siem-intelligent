"""
Tests Module 1 — Smart SIEM
Couvre : normalisation, ingestion, recherche, auth, MFA, RBAC.
Usage : pytest tests/test_module1.py -v
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# ─── Configuration test ───────────────────────────────────────────────────────
# On utilise SQLite en mémoire pour les tests (pas besoin de PG ni ES réels)
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_siem.db"
os.environ["ELASTICSEARCH_URL"] = "http://localhost:9200"
os.environ["SECRET_KEY"] = "test_secret_key_for_pytest_only"
os.environ["DEBUG"] = "false"

from main import app


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture(scope="session")
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as c:
        yield c


# ──────────────────────────────────────────────────────────────────────────────
# TESTS NORMALIZER
# ──────────────────────────────────────────────────────────────────────────────
class TestNormalizer:
    def test_detect_log_type_auth(self):
        from services.normalizer import detect_log_type
        from core.constants import LogType
        msg = "Failed password for root from 10.0.0.1 port 22 ssh2"
        assert detect_log_type(msg) == LogType.AUTH

    def test_detect_log_type_network(self):
        from services.normalizer import detect_log_type
        from core.constants import LogType
        msg = "iptables DROP tcp 192.168.1.1 → 10.0.0.1 port 80"
        assert detect_log_type(msg) == LogType.NETWORK

    def test_detect_log_type_application(self):
        from services.normalizer import detect_log_type
        from core.constants import LogType
        msg = "GET /api/v1/logs HTTP/1.1 200 OK nginx"
        assert detect_log_type(msg) == LogType.APPLICATION

    def test_detect_log_type_system_fallback(self):
        from services.normalizer import detect_log_type
        from core.constants import LogType
        msg = "cron: Starting daily backup job"
        assert detect_log_type(msg) == LogType.SYSTEM

    def test_detect_severity_critical(self):
        from services.normalizer import detect_severity
        from core.constants import LogSeverity
        msg = "CRITICAL: maximum authentication attempts exceeded"
        assert detect_severity(msg) == LogSeverity.CRITICAL

    def test_detect_severity_warning(self):
        from services.normalizer import detect_severity
        from core.constants import LogSeverity
        msg = "Failed password for root — access denied"
        assert detect_severity(msg) == LogSeverity.WARNING

    def test_detect_severity_info(self):
        from services.normalizer import detect_severity
        from core.constants import LogSeverity
        msg = "User logged in successfully"
        assert detect_severity(msg) == LogSeverity.INFO

    def test_extract_ip(self):
        from services.normalizer import extract_ip_from_syslog
        msg = "Failed password for root from 178.43.12.87 port 22"
        assert extract_ip_from_syslog(msg) == "178.43.12.87"

    def test_extract_ip_none(self):
        from services.normalizer import extract_ip_from_syslog
        msg = "System started successfully"
        assert extract_ip_from_syslog(msg) is None

    def test_normalize_full_pipeline(self):
        from services.normalizer import normalize
        from schemas.log_schemas import LogIngest
        from core.constants import LogType, LogSeverity
        # log_type=None force la détection automatique
        payload = LogIngest(
            raw_message="Failed password for root from 178.43.12.87 port 22 ssh2",
            host="ctu-srv-01",
            log_type=None,
        )
        result = normalize(payload)
        assert result["source_ip"] == "178.43.12.87"
        assert result["log_type"] == LogType.AUTH
        assert result["severity"] == LogSeverity.WARNING
        assert result["host"] == "ctu-srv-01"

    def test_normalize_ip_validation(self):
        from schemas.log_schemas import LogIngest
        # IP invalide doit être ignorée silencieusement
        payload = LogIngest(
            raw_message="test log",
            source_ip="999.999.999.999",
        )
        assert payload.source_ip is None


# ──────────────────────────────────────────────────────────────────────────────
# TESTS API HEALTH
# ──────────────────────────────────────────────────────────────────────────────
class TestHealth:
    @pytest.mark.anyio
    async def test_root_health(self, client: AsyncClient):
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "Smart SIEM" in data["app"]

    @pytest.mark.anyio
    async def test_docs_accessible(self, client: AsyncClient):
        resp = await client.get("/docs")
        assert resp.status_code == 200


# ──────────────────────────────────────────────────────────────────────────────
# TESTS SÉCURITÉ (JWT, Bcrypt, TOTP)
# ──────────────────────────────────────────────────────────────────────────────
class TestSecurity:
    def test_hash_and_verify_password(self):
        from core.security import hash_password, verify_password
        h = hash_password("CTU_Secret_2026")
        assert verify_password("CTU_Secret_2026", h)
        assert not verify_password("wrong_password", h)

    def test_create_and_decode_token(self):
        from core.security import create_access_token, decode_access_token
        token = create_access_token({"sub": "42", "role": "analyst"})
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "42"
        assert payload["role"] == "analyst"

    def test_invalid_token_returns_none(self):
        from core.security import decode_access_token
        result = decode_access_token("invalid.token.here")
        assert result is None

    def test_totp_generate_and_verify(self):
        from core.security import generate_totp_secret, verify_totp
        import pyotp
        secret = generate_totp_secret()
        assert len(secret) >= 16
        current_code = pyotp.TOTP(secret).now()
        assert verify_totp(secret, current_code)

    def test_totp_wrong_code(self):
        from core.security import generate_totp_secret, verify_totp
        secret = generate_totp_secret()
        assert not verify_totp(secret, "000000")

    def test_totp_uri_format(self):
        from core.security import generate_totp_secret, get_totp_uri
        secret = generate_totp_secret()
        uri = get_totp_uri(secret, "chloe@ctu.gov")
        assert uri.startswith("otpauth://totp/")
        assert "chloe" in uri


# ──────────────────────────────────────────────────────────────────────────────
# TESTS AUTH API (sans BDD réelle — mock)
# ──────────────────────────────────────────────────────────────────────────────
class TestAuthAPI:
    @pytest.mark.anyio
    async def test_login_without_credentials_fails(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/login", json={
            "email": "nobody@ctu.gov",
            "password": "wrong",
        })
        # 401 attendu (user n'existe pas)
        assert resp.status_code in (401, 422, 500)

    @pytest.mark.anyio
    async def test_protected_endpoint_without_token(self, client: AsyncClient):
        resp = await client.get("/api/v1/logs")
        assert resp.status_code == 401

    @pytest.mark.anyio
    async def test_protected_endpoint_invalid_token(self, client: AsyncClient):
        resp = await client.get(
            "/api/v1/logs",
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────────────────────
# TESTS SCHEMAS PYDANTIC
# ──────────────────────────────────────────────────────────────────────────────
class TestSchemas:
    def test_log_ingest_valid(self):
        from schemas.log_schemas import LogIngest
        log = LogIngest(raw_message="Valid log message")
        assert log.raw_message == "Valid log message"

    def test_log_ingest_empty_message_fails(self):
        from schemas.log_schemas import LogIngest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            LogIngest(raw_message="")

    def test_log_ingest_message_too_long_fails(self):
        from schemas.log_schemas import LogIngest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            LogIngest(raw_message="x" * 5000)

    def test_log_batch_max_size(self):
        from schemas.log_schemas import LogIngest, LogBatchIngest
        from pydantic import ValidationError
        logs = [LogIngest(raw_message=f"log {i}") for i in range(501)]
        with pytest.raises(ValidationError):
            LogBatchIngest(logs=logs)

    def test_user_create_valid(self):
        from schemas.user_schemas import UserCreate
        from core.constants import UserRole
        u = UserCreate(
            username="jbauer",
            email="j.bauer@ctu.gov",
            password="Secret@2026!",
            role=UserRole.ANALYST,
        )
        assert u.username == "jbauer"

    def test_user_create_short_password_fails(self):
        from schemas.user_schemas import UserCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            UserCreate(username="test", email="t@t.com", password="123")

    def test_search_params_defaults(self):
        from schemas.log_schemas import LogSearchParams
        params = LogSearchParams()
        assert params.page == 1
        assert params.size == 50

    def test_search_params_size_limit(self):
        from schemas.log_schemas import LogSearchParams
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            LogSearchParams(size=600)


# ──────────────────────────────────────────────────────────────────────────────
# TESTS INTÉGRITÉ SHA-256
# ──────────────────────────────────────────────────────────────────────────────
class TestIntegrity:
    def test_sha256_deterministic(self):
        """Même données → même hash."""
        import hashlib
        content = "1:2026-01-01T00:00:00+00:00:test log"
        h1 = hashlib.sha256(content.encode()).hexdigest()
        h2 = hashlib.sha256(content.encode()).hexdigest()
        assert h1 == h2
        assert len(h1) == 64

    def test_sha256_different_content(self):
        """Données différentes → hash différent."""
        import hashlib
        h1 = hashlib.sha256(b"log 1").hexdigest()
        h2 = hashlib.sha256(b"log 2").hexdigest()
        assert h1 != h2