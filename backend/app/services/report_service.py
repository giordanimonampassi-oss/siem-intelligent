"""Service Rapports — Module 5 (Reporting & Archivage)."""
import hashlib
import io
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_

from models.report import Report, ReportIntegrityBatch
from models.log_entry import LogEntry
from models.alert import Alert

PERIOD_DELTAS = {
    "daily":   timedelta(days=1),
    "weekly":  timedelta(days=7),
    "monthly": timedelta(days=30),
}


def _resolve_period(period: str, date_from, date_to):
    now = datetime.now(timezone.utc)
    if date_from and date_to:
        return date_from, date_to
    delta = PERIOD_DELTAS.get(period, timedelta(days=7))
    return now - delta, now


async def generate_report(
    db: AsyncSession, type_: str, period: str,
    date_from: Optional[datetime], date_to: Optional[datetime],
    user_id: Optional[uuid.UUID],
) -> Report:
    start, end = _resolve_period(period, date_from, date_to)

    total_logs = (await db.execute(
        select(func.count(LogEntry.id)).where(
            and_(LogEntry.timestamp >= start, LogEntry.timestamp <= end)
        )
    )).scalar_one()

    total_alerts = (await db.execute(
        select(func.count(Alert.id)).where(
            and_(Alert.triggered_at >= start, Alert.triggered_at <= end)
        )
    )).scalar_one()

    top_row = (await db.execute(
        select(Alert.title, func.count(Alert.id).label("count"))
        .where(and_(Alert.triggered_at >= start, Alert.triggered_at <= end))
        .group_by(Alert.title)
        .order_by(desc("count"))
        .limit(1)
    )).first()
    top_threat = top_row.title if top_row else None

    report = Report(
        type=type_, period=period, date_from=start, date_to=end,
        total_logs=total_logs, total_alerts=total_alerts,
        top_threat=top_threat, generated_by=user_id,
        summary={"total_logs": total_logs, "total_alerts": total_alerts},
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    await create_integrity_batch(db, start, end)
    return report


async def list_reports(db: AsyncSession, page: int = 1, size: int = 50) -> Dict[str, Any]:
    total = (await db.execute(select(func.count(Report.id)))).scalar_one()
    offset = (page - 1) * size
    rows = (await db.execute(
        select(Report).order_by(desc(Report.generated_at)).offset(offset).limit(size)
    )).scalars().all()
    return {"total": total, "results": rows}


async def get_report(report_id: uuid.UUID, db: AsyncSession) -> Optional[Report]:
    result = await db.execute(select(Report).where(Report.id == report_id))
    return result.scalar_one_or_none()


def render_report_pdf(report: Report) -> bytes:
    """
    Genere un PDF minimal du rapport.
    Necessite `reportlab` (pip install reportlab). Fallback texte si absent
    — a ameliorer avec une vraie mise en page (logo CTU, tableaux, etc.).
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, 800, f"Smart SIEM — Rapport {report.type.upper()}")
        c.setFont("Helvetica", 11)
        c.drawString(50, 770, f"Periode : {report.period}")
        c.drawString(50, 750, f"Du {report.date_from} au {report.date_to}")
        c.drawString(50, 720, f"Total logs : {report.total_logs}")
        c.drawString(50, 700, f"Total alertes : {report.total_alerts}")
        c.drawString(50, 680, f"Menace principale : {report.top_threat or 'N/A'}")
        c.showPage()
        c.save()
        return buf.getvalue()
    except ImportError:
        content = (
            f"Smart SIEM - Rapport {report.type}\n"
            f"Periode: {report.period}\nLogs: {report.total_logs}\n"
            f"Alertes: {report.total_alerts}\n"
        ).encode("latin-1", "replace")
        return content


# ─── Integrite (chain of custody) ────────────────────────────────────────────

async def create_integrity_batch(db: AsyncSession, start: datetime, end: datetime) -> ReportIntegrityBatch:
    logs = (await db.execute(
        select(LogEntry.id, LogEntry.raw_message, LogEntry.timestamp)
        .where(and_(LogEntry.timestamp >= start, LogEntry.timestamp <= end))
        .order_by(LogEntry.timestamp)
    )).all()

    hasher = hashlib.sha256()
    for row in logs:
        hasher.update(f"{row.id}|{row.timestamp}|{row.raw_message}".encode("utf-8"))
    digest = hasher.hexdigest()

    batch = ReportIntegrityBatch(
        period_start=start, period_end=end,
        log_count=len(logs), sha256_hash=digest, verified=True,
    )
    db.add(batch)
    await db.commit()
    await db.refresh(batch)
    return batch


async def list_integrity_batches(db: AsyncSession, page: int = 1, size: int = 50) -> Dict[str, Any]:
    total = (await db.execute(select(func.count(ReportIntegrityBatch.id)))).scalar_one()
    offset = (page - 1) * size
    rows = (await db.execute(
        select(ReportIntegrityBatch).order_by(desc(ReportIntegrityBatch.period_start))
        .offset(offset).limit(size)
    )).scalars().all()
    return {"total": total, "results": rows}


async def verify_integrity_batch(batch_id: uuid.UUID, db: AsyncSession) -> Optional[ReportIntegrityBatch]:
    """Recalcule le hash sur la periode du lot et compare."""
    result = await db.execute(select(ReportIntegrityBatch).where(ReportIntegrityBatch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        return None

    logs = (await db.execute(
        select(LogEntry.id, LogEntry.raw_message, LogEntry.timestamp)
        .where(and_(LogEntry.timestamp >= batch.period_start, LogEntry.timestamp <= batch.period_end))
        .order_by(LogEntry.timestamp)
    )).all()
    hasher = hashlib.sha256()
    for row in logs:
        hasher.update(f"{row.id}|{row.timestamp}|{row.raw_message}".encode("utf-8"))
    recalculated = hasher.hexdigest()

    batch.verified = (recalculated == batch.sha256_hash)
    await db.commit()
    await db.refresh(batch)
    return batch