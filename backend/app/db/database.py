"""
Connexions BDD — Smart SIEM.
PostgreSQL via psycopg3 + Elasticsearch async.
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from elasticsearch import AsyncElasticsearch
from core.config import settings


engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    # pool_size=10,
    # max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def _make_es() -> AsyncElasticsearch:
    kw: dict = {"hosts": [settings.elasticsearch_url], "verify_certs": False, "ssl_show_warn": False}
    if settings.elasticsearch_user:
        kw["basic_auth"] = (settings.elasticsearch_user, settings.elasticsearch_password)
    return AsyncElasticsearch(**kw)


es_client: AsyncElasticsearch = _make_es()


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_es() -> AsyncElasticsearch:
    return es_client


ES_LOGS_MAPPING = {
    "mappings": {
        "properties": {
            "id":            {"type": "keyword"},
            "timestamp":     {"type": "date"},
            "source_ip":     {"type": "ip"},
            "dest_ip":       {"type": "ip"},
            "host":          {"type": "keyword"},
            "username":      {"type": "keyword"},
            "log_type":      {"type": "keyword"},
            "severity":      {"type": "keyword"},
            "raw_message":   {"type": "text", "analyzer": "standard",
                               "fields": {"keyword": {"type": "keyword", "ignore_above": 512}}},
            "is_suspicious": {"type": "boolean"},
            "batch_id":      {"type": "keyword"},
            "node_id":       {"type": "keyword"},
            "created_at":    {"type": "date"},
        }
    },
    "settings": {"number_of_shards": 1, "number_of_replicas": 0, "refresh_interval": "5s"},
}

ES_ALERTS_MAPPING = {
    "mappings": {
        "properties": {
            "id":              {"type": "keyword"},
            "alert_id":        {"type": "keyword"},
            "severity":        {"type": "keyword"},
            "status":          {"type": "keyword"},
            "title":           {"type": "text"},
            "description":     {"type": "text"},
            "source_ip":       {"type": "ip"},
            "target_host":     {"type": "keyword"},
            "username":        {"type": "keyword"},
            "mitre_tactic":    {"type": "keyword"},
            "mitre_technique": {"type": "keyword"},
            "confidence":      {"type": "float"},
            "triggered_at":    {"type": "date"},
        }
    },
    "settings": {"number_of_shards": 1, "number_of_replicas": 0},
}


async def init_elasticsearch():
    for idx, mapping in [
        (settings.elasticsearch_index_logs, ES_LOGS_MAPPING),
        ("alerts", ES_ALERTS_MAPPING),
    ]:
        try:
            if not await es_client.indices.exists(index=idx):
                await es_client.indices.create(index=idx, body=mapping)
                print(f"[ES] Index '{idx}' cree.")
            else:
                print(f"[ES] Index '{idx}' deja existant.")
        except Exception as e:
            print(f"[ES] Erreur init index {idx}: {e}")


async def init_db():
    from models import user, log_entry, alert, playbook, ueba, infrastructure, audit_log
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[PG] Tables initialisees.")