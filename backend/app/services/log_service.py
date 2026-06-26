"""
Service logs — Module 1 (collecte/normalisation) + Module 2 (stockage/indexation).
PostgreSQL = source de vérité structurée.
Elasticsearch = moteur de recherche full-text.
"""
import hashlib
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from elasticsearch import AsyncElasticsearch

from models.log_entry import LogEntry
from models.infrastructure import LogAggregate
from schemas.log_schemas import (
    LogIngest, LogBatchIngest, LogSearchParams,
    LogSearchResult, LogDetail, BatchIntegrityResponse,
)
from services.normalizer import normalize
from core.config import settings


# ─── MODULE 1 : Collecte et Normalisation ────────────────────────────────────

async def ingest_log(
    payload: LogIngest,
    db: AsyncSession,
    es: AsyncElasticsearch,
) -> LogEntry:
    """Ingestion d'un log unique : normalisation → PostgreSQL → Elasticsearch."""
    data  = normalize(payload)
    entry = LogEntry(**data)
    db.add(entry)
    await db.flush()            # Obtenir l'UUID sans commit

    # Indexation ES (non-bloquante)
    es_ok = await _index_es(entry, es)
    entry.es_indexed = es_ok

    await db.commit()
    await db.refresh(entry)
    return entry


async def ingest_batch(
    payload: LogBatchIngest,
    db: AsyncSession,
    es: AsyncElasticsearch,
) -> Dict[str, Any]:
    """Ingestion par lot (max 500) avec bulk Elasticsearch."""
    batch_id = payload.batch_id or str(uuid_lib.uuid4())[:8].upper()
    entries: List[LogEntry] = []

    for log_payload in payload.logs:
        log_payload.batch_id = log_payload.batch_id or batch_id
        data  = normalize(log_payload)
        entry = LogEntry(**data)
        db.add(entry)
        entries.append(entry)

    await db.flush()

    # ── MODULE 2 : Bulk indexation Elasticsearch ──────────────────────────────
    ops = []
    for e in entries:
        ops.append({"index": {
            "_index": settings.elasticsearch_index_logs,
            "_id":    str(e.id),
        }})
        ops.append(e.to_es_doc())

    es_success = 0
    if ops:
        try:
            resp = await es.bulk(operations=ops, refresh=False)
            es_success = sum(
                1 for item in resp.get("items", [])
                if item.get("index", {}).get("result") in ("created", "updated")
            )
            # Marquer les entrées indexées
            for e in entries:
                e.es_indexed = True
        except Exception as exc:
            print(f"[ES] Bulk error : {exc}")

    await db.commit()

    # ── MODULE 2 : Enregistrement agrégat + hash SHA-256 ─────────────────────
    sha256 = _compute_hash(entries)
    agg = LogAggregate(
        period_start=min(e.timestamp for e in entries),
        period_end=max(e.timestamp for e in entries),
        log_count=len(entries),
        sha256_hash=sha256,
        batch_id=batch_id,
    )
    db.add(agg)
    await db.commit()

    return {
        "batch_id":    batch_id,
        "ingested":    len(entries),
        "es_indexed":  es_success,
        "critical":    sum(1 for e in entries if e.severity == "CRITICAL"),
        "warning":     sum(1 for e in entries if e.severity == "WARNING"),
        "sha256":      sha256,
    }


# ─── MODULE 2 : Stockage et Indexation ───────────────────────────────────────

async def search_logs_pg(
    params: LogSearchParams,
    db: AsyncSession,
) -> LogSearchResult:
    """Recherche structurée sur PostgreSQL (exact match, filtres multiples)."""
    filters = []
    if params.source_ip:  filters.append(LogEntry.source_ip == params.source_ip)
    if params.dest_ip:    filters.append(LogEntry.dest_ip == params.dest_ip)
    if params.username:   filters.append(LogEntry.username.ilike(f"%{params.username}%"))
    if params.host:       filters.append(LogEntry.host.ilike(f"%{params.host}%"))
    if params.log_type:   filters.append(LogEntry.log_type == params.log_type.value)
    if params.severity:   filters.append(LogEntry.severity == params.severity.value)
    if params.from_dt:    filters.append(LogEntry.timestamp >= params.from_dt)
    if params.to_dt:      filters.append(LogEntry.timestamp <= params.to_dt)
    if params.keyword:    filters.append(LogEntry.raw_message.ilike(f"%{params.keyword}%"))

    base_q = select(LogEntry)
    if filters:
        base_q = base_q.where(and_(*filters))

    total = (await db.execute(
        select(func.count()).select_from(base_q.subquery())
    )).scalar_one()

    offset = (params.page - 1) * params.size
    rows = (await db.execute(
        base_q.order_by(LogEntry.timestamp.desc())
               .offset(offset).limit(params.size)
    )).scalars().all()

    return LogSearchResult(
        total=total, page=params.page, size=params.size,
        results=[LogDetail.model_validate(r) for r in rows],
    )


async def search_logs_es(
    params: LogSearchParams,
    es: AsyncElasticsearch,
) -> LogSearchResult:
    """Recherche full-text Elasticsearch (keyword, multi-champ)."""
    must, filters = [], []

    if params.keyword:
        must.append({"multi_match": {
            "query":  params.keyword,
            "fields": ["raw_message", "host", "username", "source_ip"],
        }})
    if params.source_ip: filters.append({"term": {"source_ip": params.source_ip}})
    if params.dest_ip:   filters.append({"term": {"dest_ip":   params.dest_ip}})
    if params.host:      filters.append({"term": {"host":      params.host}})
    if params.username:  filters.append({"term": {"username":  params.username}})
    if params.log_type:  filters.append({"term": {"log_type":  params.log_type.value}})
    if params.severity:  filters.append({"term": {"severity":  params.severity.value}})
    if params.from_dt or params.to_dt:
        rng: Dict[str, Any] = {}
        if params.from_dt: rng["gte"] = params.from_dt.isoformat()
        if params.to_dt:   rng["lte"] = params.to_dt.isoformat()
        filters.append({"range": {"timestamp": rng}})

    if must or filters:
        query: Dict[str, Any] = {"bool": {}}
        if must:    query["bool"]["must"]   = must
        if filters: query["bool"]["filter"] = filters
    else:
        query = {"match_all": {}}

    offset = (params.page - 1) * params.size
    resp = await es.search(
        index=settings.elasticsearch_index_logs,
        query=query,
        from_=offset,
        size=params.size,
        sort=[{"timestamp": {"order": "desc"}}],
    )

    hits  = resp["hits"]["hits"]
    total = resp["hits"]["total"]["value"]

    results = []
    for hit in hits:
        src = hit["_source"]
        # Convertir les types ES → LogDetail
        results.append(LogDetail(
            id=src.get("id", hit["_id"]),
            timestamp=src.get("timestamp"),
            source_ip=src.get("source_ip"),
            dest_ip=src.get("dest_ip"),
            host=src.get("host"),
            username=src.get("username"),
            log_type=src.get("log_type", "SYSTEM"),
            severity=src.get("severity", "INFO"),
            raw_message=src.get("raw_message", ""),
            is_suspicious=src.get("is_suspicious", False),
            note=src.get("note"),
            batch_id=src.get("batch_id"),
            es_indexed=True,
            created_at=src.get("created_at", src.get("timestamp")),
        ))

    return LogSearchResult(total=total, page=params.page, size=params.size, results=results)


async def mark_suspicious(
    log_id: uuid_lib.UUID,
    is_suspicious: bool,
    note: Optional[str],
    db: AsyncSession,
    es: AsyncElasticsearch,
) -> Optional[LogEntry]:
    """Marque un log comme suspect dans PG + ES."""
    result = await db.execute(select(LogEntry).where(LogEntry.id == log_id))
    entry  = result.scalar_one_or_none()
    if not entry:
        return None
    entry.is_suspicious = is_suspicious
    entry.note = note
    await db.commit()
    await db.refresh(entry)
    # Mise à jour ES
    try:
        await es.update(
            index=settings.elasticsearch_index_logs,
            id=str(log_id),
            doc={"is_suspicious": is_suspicious, "note": note},
            ignore_status=[404],
        )
    except Exception:
        pass
    return entry


async def get_batch_integrity(
    batch_id: str,
    db: AsyncSession,
) -> BatchIntegrityResponse:
    """Recalcule le SHA-256 d'un lot et le compare à celui stocké."""
    result = await db.execute(
        select(LogEntry)
        .where(LogEntry.batch_id == batch_id)
        .order_by(LogEntry.created_at)
    )
    entries = result.scalars().all()
    sha256  = _compute_hash(entries)

    # Vérifier l'agrégat stocké
    agg_result = await db.execute(
        select(LogAggregate).where(LogAggregate.batch_id == batch_id)
    )
    agg = agg_result.scalar_one_or_none()
    verified = (agg is not None and agg.sha256_hash == sha256)

    if agg and verified and not agg.verified:
        agg.verified    = True
        agg.verified_at = datetime.now(timezone.utc)
        await db.commit()

    return BatchIntegrityResponse(
        batch_id=batch_id,
        sha256=sha256,
        log_count=len(entries),
        verified=verified,
    )


# ─── Privé ───────────────────────────────────────────────────────────────────

def _compute_hash(entries: List[LogEntry]) -> str:
    content = "|".join(
        f"{e.id}:{e.timestamp.isoformat()}:{e.raw_message}"
        for e in entries
    )
    return hashlib.sha256(content.encode()).hexdigest()


async def _index_es(entry: LogEntry, es: AsyncElasticsearch) -> bool:
    try:
        await es.index(
            index=settings.elasticsearch_index_logs,
            id=str(entry.id),
            document=entry.to_es_doc(),
        )
        return True
    except Exception as exc:
        print(f"[ES] Erreur index log {entry.id}: {exc}")
        return False