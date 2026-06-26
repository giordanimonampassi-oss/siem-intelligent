"""Endpoints logs — /api/v1/logs — Module 1 & 2."""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from elasticsearch import AsyncElasticsearch

from api.v1.dependencies import (
    get_db, get_es, get_current_user, require_analyst, require_auditor
)
from models.log_entry import LogEntry
from models.user import CTSUser
from schemas.log_schemas import (
    LogIngest, LogBatchIngest, LogResponse, LogDetail,
    LogSearchParams, LogSearchResult, LogMarkSuspicious,
    BatchIntegrityResponse,
)
from services import log_service
from services.auth_service import log_audit
from core.constants import LogSeverity, LogType

router = APIRouter(prefix="/logs", tags=["Logs — Module 1 & 2"])


@router.post("", response_model=LogResponse, status_code=201)
async def ingest_log(
    payload: LogIngest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    es: AsyncElasticsearch = Depends(get_es),
    current_user: CTSUser = Depends(get_current_user),
):
    """Ingestion d'un log unique — normalisation + stockage PG + indexation ES."""
    entry = await log_service.ingest_log(payload, db, es)
    await log_audit("log_ingested", db, user_id=current_user.id,
                    target=f"log#{entry.id}",
                    ip=request.client.host if request.client else None)
    await db.commit()
    return LogResponse(
        log_id=entry.id,
        timestamp=entry.timestamp,
        severity=entry.severity,
        log_type=entry.log_type,
        batch_id=entry.batch_id,
        es_indexed=entry.es_indexed,
    )


@router.post("/batch", status_code=201)
async def ingest_batch(
    payload: LogBatchIngest,
    db: AsyncSession = Depends(get_db),
    es: AsyncElasticsearch = Depends(get_es),
    current_user: CTSUser = Depends(get_current_user),
):
    """Ingestion par lot (max 500 logs) — optimisée avec bulk ES et hash SHA-256."""
    result = await log_service.ingest_batch(payload, db, es)
    await log_audit("batch_ingested", db, user_id=current_user.id,
                    target=result["batch_id"],
                    detail=f"{result['ingested']} logs")
    await db.commit()
    return result


@router.get("", response_model=LogSearchResult)
async def search_logs(
    source_ip: Optional[str]         = Query(None),
    dest_ip:   Optional[str]         = Query(None),
    username:  Optional[str]         = Query(None),
    host:      Optional[str]         = Query(None),
    log_type:  Optional[LogType]     = Query(None),
    severity:  Optional[LogSeverity] = Query(None),
    from_dt:   Optional[str]         = Query(None, description="ISO 8601, ex: 2026-03-14T00:00:00Z"),
    to_dt:     Optional[str]         = Query(None, description="ISO 8601"),
    keyword:   Optional[str]         = Query(None, description="Full-text dans raw_message"),
    engine:    str                   = Query("es", description="'es' (Elasticsearch) ou 'pg' (PostgreSQL)"),
    page:      int                   = Query(1, ge=1),
    size:      int                   = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    es: AsyncElasticsearch = Depends(get_es),
    current_user: CTSUser = Depends(get_current_user),
):
    """
    Recherche multi-critères.
    - engine=es  → Elasticsearch (full-text, recommandé pour la recherche forensique)
    - engine=pg  → PostgreSQL (filtres exacts, requêtes structurées)
    """
    from datetime import datetime
    params = LogSearchParams(
        source_ip=source_ip, dest_ip=dest_ip, username=username, host=host,
        log_type=log_type, severity=severity, keyword=keyword, page=page, size=size,
        from_dt=datetime.fromisoformat(from_dt.replace("Z", "+00:00")) if from_dt else None,
        to_dt=datetime.fromisoformat(to_dt.replace("Z", "+00:00")) if to_dt else None,
    )
    if engine == "pg":
        return await log_service.search_logs_pg(params, db)
    return await log_service.search_logs_es(params, es)


@router.get("/health", tags=["Health"])
async def logs_health(
    db: AsyncSession = Depends(get_db),
    es: AsyncElasticsearch = Depends(get_es),
):
    """Vérifie la connectivité PostgreSQL et Elasticsearch."""
    pg_ok, es_ok = False, False
    try:
        await db.execute(select(1))
        pg_ok = True
    except Exception as e:
        pass
    try:
        es_ok = await es.ping()
    except Exception:
        pass
    return {
        "postgresql":    "ok" if pg_ok else "error",
        "elasticsearch": "ok" if es_ok else "error",
        "status":        "healthy" if (pg_ok and es_ok) else "degraded",
    }


@router.get("/{log_id}", response_model=LogDetail)
async def get_log(
    log_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    """Détail complet d'un log par son UUID."""
    result = await db.execute(select(LogEntry).where(LogEntry.id == log_id))
    entry  = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Log introuvable")
    return LogDetail.model_validate(entry)


@router.patch("/{log_id}/flag", response_model=LogDetail)
async def flag_log(
    log_id: uuid.UUID,
    payload: LogMarkSuspicious,
    request: Request,
    db: AsyncSession = Depends(get_db),
    es: AsyncElasticsearch = Depends(get_es),
    current_user: CTSUser = Depends(require_analyst),
):
    """Marque un log comme suspect avec une note d'investigation."""
    entry = await log_service.mark_suspicious(log_id, payload.is_suspicious, payload.note, db, es)
    if not entry:
        raise HTTPException(status_code=404, detail="Log introuvable")
    await log_audit("log_flagged", db, user_id=current_user.id,
                    target=str(log_id),
                    ip=request.client.host if request.client else None)
    await db.commit()
    return LogDetail.model_validate(entry)


@router.get("/integrity/{batch_id}", response_model=BatchIntegrityResponse)
async def verify_integrity(
    batch_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(require_auditor),
):
    """
    Vérifie l'intégrité SHA-256 d'un lot de logs.
    Réservé aux AUDITOR et ADMIN (chain of custody).
    """
    return await log_service.get_batch_integrity(batch_id, db)