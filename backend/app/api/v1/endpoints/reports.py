"""Endpoints Rapports & Archivage — /api/v1/reports (Module 5)."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.dependencies import get_db, get_current_user, require_analyst
from models.user import CTSUser
from schemas.report_schemas import (
    ReportGenerateRequest, ReportResponse, ReportListResponse,
    IntegrityBatchResponse, IntegrityBatchListResponse,
)
from services import report_service

router = APIRouter(prefix="/reports", tags=["Rapports — Module 5"])


@router.get("", response_model=ReportListResponse)
async def list_reports(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    result = await report_service.list_reports(db, page, size)
    return ReportListResponse(
        total=result["total"],
        results=[ReportResponse.model_validate(r) for r in result["results"]],
    )


@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    payload: ReportGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(require_analyst),
):
    report = await report_service.generate_report(
        db, payload.type, payload.period, payload.date_from, payload.date_to,
        current_user.id,
    )
    return ReportResponse.model_validate(report)


@router.get("/integrity", response_model=IntegrityBatchListResponse)
async def list_integrity(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    result = await report_service.list_integrity_batches(db, page, size)
    return IntegrityBatchListResponse(
        total=result["total"],
        results=[IntegrityBatchResponse.model_validate(r) for r in result["results"]],
    )


@router.post("/integrity/{batch_id}/verify")
async def verify_integrity(
    batch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    batch = await report_service.verify_integrity_batch(batch_id, db)
    if not batch:
        raise HTTPException(status_code=404, detail="Lot introuvable")
    return {"id": str(batch.id), "verified": batch.verified, "sha256_hash": batch.sha256_hash}


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    report = await report_service.get_report(report_id, db)
    if not report:
        raise HTTPException(status_code=404, detail="Rapport introuvable")
    return ReportResponse.model_validate(report)


@router.get("/{report_id}/download")
async def download_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    report = await report_service.get_report(report_id, db)
    if not report:
        raise HTTPException(status_code=404, detail="Rapport introuvable")
    pdf_bytes = report_service.render_report_pdf(report)
    filename = f"rapport-{report.type}-{report.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )