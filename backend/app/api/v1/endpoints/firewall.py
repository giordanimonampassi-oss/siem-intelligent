# api/v1/endpoints/firewall.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.dependencies import get_db, get_current_user, require_analyst
from services import firewall_service

router = APIRouter(prefix="/firewall", tags=["Blocage IP — Module 3"])


@router.get("/blocked-ips")
async def list_blocked_ips(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    entries = await firewall_service.list_blocked(db)
    return [
        {"ip_address": e.ip_address, "reason": e.reason,
         "blocked_at": e.blocked_at, "expires_at": e.expires_at}
        for e in entries
    ]


@router.post("/blocked-ips/{ip}/unblock")
async def unblock_ip_endpoint(ip: str, db: AsyncSession = Depends(get_db), current_user=Depends(require_analyst)):
    entry = await firewall_service.unblock_ip(db, ip)
    if not entry:
        raise HTTPException(status_code=404, detail="IP non trouvee dans la liste de blocage")
    return {"message": f"{ip} debloquee"}