"""
Endpoints authentification — /api/v1/auth
Gestion des rôles : READER, ANALYST, RSSI, AUDITOR, ADMIN
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from api.v1.dependencies import get_db, get_current_user, require_admin
from models.user import CTSUser
from models.audit_log import AuditLog
from schemas.user_schemas import (
    LoginRequest, TokenResponse, UserCreate, UserUpdate,
    UserResponse, MFASetupResponse, MFAVerifyRequest,
    ChangePasswordRequest,
)
from services import auth_service
from core.constants import UserRole

router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])


# ─── Login étape 1 ───────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Étape 1 : email + mot de passe.
    Si MFA activé → retourne mfa_required=true, le client appelle /mfa/verify ensuite.
    """
    user = await auth_service.authenticate(payload.email, payload.password, db)
    if not user:
        await auth_service.log_audit("login_failed", db,
                                     target=payload.email,
                                     ip=request.client.host if request.client else None,
                                     result="failed")
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Email ou mot de passe incorrect")

    mfa_required = user.mfa_enabled
    token = auth_service.build_token(user, mfa_verified=not mfa_required)

    if not mfa_required:
        await auth_service.update_last_login(user, db)
        await auth_service.log_audit("login", db, user_id=user.id,
                                     ip=request.client.host if request.client else None)
        await db.commit()

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
        mfa_required=mfa_required,
    )


# ─── MFA Setup (premier login) ───────────────────────────────────────────────

@router.post("/mfa/setup", response_model=MFASetupResponse)
async def mfa_setup(
    current_user: CTSUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Génère un secret TOTP et retourne l'URI pour le QR code."""
    if current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA déjà activé sur ce compte")
    result = await auth_service.setup_mfa(current_user, db)
    return MFASetupResponse(**result)


@router.post("/mfa/confirm")
async def mfa_confirm(
    payload: MFAVerifyRequest,
    current_user: CTSUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Active le MFA après vérification du premier code TOTP."""
    ok = await auth_service.confirm_mfa(current_user, payload.code, db)
    if not ok:
        raise HTTPException(status_code=400, detail="Code TOTP invalide")
    return {"message": "MFA activé avec succès — conservez votre secret en lieu sûr"}


# ─── MFA Vérification (login step 2) ─────────────────────────────────────────

@router.post("/mfa/verify", response_model=TokenResponse)
async def mfa_verify(
    payload: MFAVerifyRequest,
    request: Request,
    current_user: CTSUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Étape 2 du login : vérification du code TOTP."""
    ok = await auth_service.verify_mfa_code(current_user, payload.code)
    if not ok:
        raise HTTPException(status_code=401, detail="Code MFA invalide ou expiré (fenêtre 30s)")

    await auth_service.update_last_login(current_user, db)
    await auth_service.log_audit("mfa_verified", db, user_id=current_user.id,
                                 ip=request.client.host if request.client else None)
    await db.commit()

    token = auth_service.build_token(current_user, mfa_verified=True)
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(current_user),
        mfa_required=False,
    )


# ─── Profil utilisateur courant ───────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CTSUser = Depends(get_current_user)):
    """Retourne le profil de l'utilisateur connecté."""
    return UserResponse.model_validate(current_user)


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: CTSUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await auth_service.change_password(
        current_user, payload.old_password, payload.new_password, db
    )
    if not ok:
        raise HTTPException(status_code=400, detail="Ancien mot de passe incorrect")
    return {"message": "Mot de passe modifié avec succès"}


# ─── Gestion des utilisateurs (ADMIN uniquement) ─────────────────────────────

@router.post("/users", response_model=UserResponse,
             dependencies=[Depends(require_admin)])
async def create_user(
    payload: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    """Crée un utilisateur — réservé aux administrateurs."""
    existing = await db.execute(select(CTSUser).where(CTSUser.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email déjà utilisé")
    user = await auth_service.create_user(payload, db)
    await auth_service.log_audit("user_created", db, user_id=current_user.id,
                                 target=payload.email,
                                 ip=request.client.host if request.client else None)
    await db.commit()
    return UserResponse.model_validate(user)


@router.get("/users", response_model=list[UserResponse],
            dependencies=[Depends(require_admin)])
async def list_users(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """Liste tous les utilisateurs — admin uniquement."""
    result = await db.execute(select(CTSUser).offset(skip).limit(limit))
    return [UserResponse.model_validate(u) for u in result.scalars().all()]


@router.get("/users/{user_id}", response_model=UserResponse,
            dependencies=[Depends(require_admin)])
async def get_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CTSUser).where(CTSUser.id == user_id))
    user   = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return UserResponse.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserResponse,
              dependencies=[Depends(require_admin)])
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    """Modifie le rôle, le périmètre ou le statut d'un utilisateur."""
    user = await auth_service.update_user(user_id, payload, db)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    await auth_service.log_audit("user_updated", db, user_id=current_user.id,
                                 target=str(user_id),
                                 ip=request.client.host if request.client else None)
    await db.commit()
    return UserResponse.model_validate(user)


@router.delete("/users/{user_id}", dependencies=[Depends(require_admin)])
async def disable_user(
    user_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    """Désactive un compte utilisateur (soft delete)."""
    result = await db.execute(select(CTSUser).where(CTSUser.id == user_id))
    user   = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas désactiver votre propre compte")
    user.is_active = False
    await auth_service.log_audit("user_disabled", db, user_id=current_user.id,
                                 target=str(user_id),
                                 ip=request.client.host if request.client else None)
    await db.commit()
    return {"message": f"Compte {user.username} désactivé"}


# ─── Audit log (AUDITOR / ADMIN) ─────────────────────────────────────────────

@router.get("/audit", tags=["Audit"])
async def get_audit_log(
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
):
    """
    Retourne les dernières entrées d'audit.
    Accessible aux AUDITOR et ADMIN uniquement.
    """
    allowed = ["AUDITOR", "ADMIN"]
    if current_user.role not in allowed:
        raise HTTPException(status_code=403, detail="Réservé aux auditeurs et administrateurs")

    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    )
    logs = result.scalars().all()
    return [
        {
            "id":            str(l.id),
            "user_id":       str(l.user_id) if l.user_id else None,
            "action":        l.action,
            "target_entity": l.target_entity,
            "ip_address":    l.ip_address,
            "result":        l.result,
            "created_at":    l.created_at.isoformat(),
        }
        for l in logs
    ]