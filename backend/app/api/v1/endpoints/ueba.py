"""Endpoints UEBA — /api/v1/ueba (Module 4)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.dependencies import get_db, get_current_user
from models.user import CTSUser
from schemas.ueba_schemas import (
    UEBAProfileResponse, UEBAProfileListResponse,
    AnomalyResponse, AnomalyListResponse,
    ScoreHistoryResponse, ScoreHistoryPoint,
)
from services import ueba_service

router = APIRouter(prefix="/ueba", tags=["UEBA — Module 4"])


@router.get("/profiles", response_model=UEBAProfileListResponse)
async def list_profiles(
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    profiles = await ueba_service.list_profiles(db)
    return UEBAProfileListResponse(
        total=len(profiles),
        results=[UEBAProfileResponse(**p) for p in profiles],
    )


@router.get("/profiles/{entity_id}", response_model=UEBAProfileResponse)
async def get_profile(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    profile = await ueba_service.get_profile(entity_id, db)
    if not profile:
        raise HTTPException(status_code=404, detail="Profil introuvable")
    return UEBAProfileResponse(**profile)


@router.get("/profiles/{entity_id}/anomalies", response_model=AnomalyListResponse)
async def get_anomalies(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    anomalies = await ueba_service.get_anomalies(entity_id, db)
    return AnomalyListResponse(
        total=len(anomalies),
        results=[AnomalyResponse.model_validate(a) for a in anomalies],
    )


@router.get("/profiles/{entity_id}/history", response_model=ScoreHistoryResponse)
async def get_score_history(
    entity_id: str,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    history = await ueba_service.get_score_history(entity_id, days, db)
    return ScoreHistoryResponse(
        entity_id=entity_id,
        history=[ScoreHistoryPoint(**h) for h in history],
    )


# @router.post("/bootstrap")
# async def bootstrap(
#     db: AsyncSession = Depends(get_db),
#     current_user: CTSUser = Depends(get_current_user),
# ):
#     """
#     Placeholder pour le bootstrapping de la baseline (script Python fourni
#     dans le cahier des charges, dataset 30 jours). A brancher.
#     """
#     return {"message": "Bootstrap non implemente — a brancher sur le dataset simule"}
@router.post("/bootstrap")
async def bootstrap(
    window_days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    result = await ueba_service.bootstrap_baselines(db, window_days)
    return {"message": "Baseline recalculee", **result}


@router.post("/snapshot")
async def trigger_snapshot(
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    """Declenchement manuel du snapshot (utile pour tester sans attendre le scheduler)."""
    count = await ueba_service.snapshot_all_profiles(db)
    return {"message": f"{count} profils snapshotes"}