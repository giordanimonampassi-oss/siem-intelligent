"""
Endpoints Regles de correlation — /api/v1/rules
Module 3 : CRUD complet + seed MITRE ATT&CK + toggle.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.dependencies import get_db, get_current_user, require_analyst, require_admin
from models.user import CTSUser
from schemas.alert_schemas import RuleCreate, RuleUpdate, RuleResponse
from services import rule_service
from services.auth_service import log_audit

router = APIRouter(prefix="/rules", tags=["Regles de correlation — Module 3"])


@router.get("", response_model=list[RuleResponse])
async def list_rules(
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    """Liste toutes les regles (ou seulement les actives)."""
    rules = await rule_service.list_rules(db, active_only=active_only)
    return [RuleResponse.model_validate(r) for r in rules]


@router.post("", response_model=RuleResponse, status_code=201)
async def create_rule(
    payload: RuleCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(require_analyst),
):
    """Cree une nouvelle regle de correlation."""
    rule = await rule_service.create_rule(payload.model_dump(), db)
    await log_audit("rule_created", db, user_id=current_user.id,
                    target=rule.name, ip=request.client.host if request.client else None)
    await db.commit()
    return RuleResponse.model_validate(rule)


@router.get("/{rule_id}", response_model=RuleResponse)
async def get_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    rule = await rule_service.get_rule(rule_id, db)
    if not rule:
        raise HTTPException(status_code=404, detail="Regle introuvable")
    return RuleResponse.model_validate(rule)


@router.patch("/{rule_id}", response_model=RuleResponse)
async def update_rule(
    rule_id: uuid.UUID,
    payload: RuleUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(require_analyst),
):
    """Modifie une regle existante."""
    rule = await rule_service.get_rule(rule_id, db)
    if not rule:
        raise HTTPException(status_code=404, detail="Regle introuvable")
    rule = await rule_service.update_rule(rule, payload.model_dump(exclude_none=True), db)
    await log_audit("rule_updated", db, user_id=current_user.id,
                    target=str(rule_id), ip=request.client.host if request.client else None)
    await db.commit()
    return RuleResponse.model_validate(rule)


@router.post("/{rule_id}/toggle", response_model=RuleResponse)
async def toggle_rule(
    rule_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(require_analyst),
):
    """Active ou desactive une regle."""
    rule = await rule_service.get_rule(rule_id, db)
    if not rule:
        raise HTTPException(status_code=404, detail="Regle introuvable")
    rule = await rule_service.toggle_rule(rule, db)
    await log_audit("rule_toggled", db, user_id=current_user.id,
                    target=f"{rule.name} -> {rule.is_active}",
                    ip=request.client.host if request.client else None)
    await db.commit()
    return RuleResponse.model_validate(rule)


@router.delete("/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(require_admin),
):
    """Supprime une regle (admin uniquement)."""
    rule = await rule_service.get_rule(rule_id, db)
    if not rule:
        raise HTTPException(status_code=404, detail="Regle introuvable")
    await log_audit("rule_deleted", db, user_id=current_user.id,
                    target=rule.name, ip=request.client.host if request.client else None)
    await rule_service.delete_rule(rule, db)


@router.post("/seed-mitre", status_code=201)
async def seed_mitre(
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(require_admin),
):
    """
    Cree les 5 regles MITRE ATT&CK obligatoires si elles n'existent pas.
    A appeler une seule fois apres le deploiement.
    """
    created = await rule_service.seed_mitre_rules(db)
    return {
        "created": created,
        "message": f"{created} regle(s) MITRE ATT&CK creee(s)" if created else "Regles deja presentes",
    }