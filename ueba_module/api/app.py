"""
api/ueba_service.py -> Sauvegardé sous api/app.py

API REST et Automate de détection pour le module UEBA.
Assure l'extraction depuis Elasticsearch, le scoring ML, et la persistance 
des alertes comportementales dans PostgreSQL via SQLAlchemy.
"""
from __future__ import annotations

import sys
from pathlib import Path

# --- HACK DE CONFIGURATION DES PATHS ---
root_path = Path(__file__).resolve().parent.parent        # ueba_module
parent_path = root_path.parent                            # siem-intelligent

if str(root_path) not in sys.path:
    sys.path.insert(0, str(root_path))
if str(parent_path) not in sys.path:
    sys.path.insert(0, str(parent_path))

import uuid
from datetime import datetime
from fastapi import FastAPI, BackgroundTasks, HTTPException, Depends
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import create_engine

# Import des modules UEBA validés
from pipeline.agent_pipeline import run_agent_pipeline
from models.anomaly_detector import get_detector
from utils.logger import get_logger

# Import réussi depuis le dossier externe 'database' grâce au hack parent_path
from ueba_module.database.models import (
    Base, CorrelationRule, Alert, RuleType, AlertSeverity, AlertStatus
)

logger = get_logger("ueba_service")

# ---------------------------------------------------------------------------
# Configuration de la Base de Données PostgreSQL (Mise à jour avec vos valeurs)
# ---------------------------------------------------------------------------
DATABASE_URL = "postgresql://siem_user:siem_password@localhost:5433/siem_db"
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------------------------------------------------------------------
# Cœur du Traitement : Pipeline de détection et Ingestion Postgres
# ---------------------------------------------------------------------------
def execute_ueba_detection_cycle():
    """
    Exécute le cycle complet d'analyse comportementale réelle :
    1. Extraction depuis Elasticsearch (Fenêtre réduite pour flux rapide)
    2. Scoring par l'Isolation Forest
    3. Transformation contextuelle et injection dans PostgreSQL
    """
    logger.info("--- DÉBUT DU CYCLE DÉTECTION UEBA AUTOMATIQUE ---")
    db = SessionLocal()
    try:
        # 1. Chargement du détecteur (Singleton)
        detector = get_detector()
        
        # 2. Récupération des données réelles Elasticsearch
        # (Passage à 1 minute pour coller au rythme ultra-rapide des 30 secondes)
        raw_df, features_df = run_agent_pipeline(window_minutes=1)
        
        if features_df.empty:
            logger.info("Cycle UEBA : Aucun nouveau log trouvé dans Elasticsearch.")
            return
        
        # 3. Confrontation avec le modèle et récupération du DataFrame de contexte enrichi
        report = detector.predict_with_context(raw_df, features_df)
        
        if report.empty:
            logger.info("Cycle UEBA : Analyse terminée. 0 anomalie détectée.")
            return

        logger.info("Cycle UEBA : %d anomalie(s) détectée(s). Début de l'écriture PostgreSQL...", len(report))
        
        # 4. Itération et conversion des anomalies selon vos modèles SQLAlchemy réels
        for _, row in report.iterrows():
            
            # Détermination de la sévérité SIEM basée sur la sévérité du log d'origine
            log_severity = str(row.get("severity", "info")).upper()
            if log_severity in ["CRITICAL", "FATAL"]:
                severity_enum = AlertSeverity.CRITICAL
            elif log_severity in ["ERROR", "FAILURE"]:
                severity_enum = AlertSeverity.HIGH
            elif log_severity in ["WARNING", "WARN"]:
                severity_enum = AlertSeverity.WARNING
            else:
                severity_enum = AlertSeverity.INFO

            # Extraction des variables de contexte issues du modèle d'anomalies
            log_username = row.get("username")
            log_ip = row.get("source_ip")
            log_host = row.get("host")
            raw_msg = row.get("raw_message", "")

            # Alignement MITRE ATT&CK dynamique basé sur la signature textuelle
            mitre_technique = "T1078 - Valid Accounts"
            if "password" in str(raw_msg).lower():
                mitre_technique = "T1110 - Brute Force"
            elif "privilege" in str(raw_msg).lower() or "sudo" in str(raw_msg).lower():
                mitre_technique = "T1068 - Exploitation for Privilege Escalation"

            # 4a. Création de la règle de corrélation d'anomalie documentée
            rule_id = uuid.uuid4()
            ueba_rule = CorrelationRule(
                id=rule_id,
                name=f"UEBA Anomaly - {row.get('log_type', 'system')}",
                rule_type=RuleType.ANOMALY,
                mitre_tactic="Initial Access",
                mitre_technique=mitre_technique,
                action="FLAG_ANOMALY",
                target_keyword=str(log_username) if log_username else None,
                ip_address=str(log_ip) if log_ip else (str(log_host) if log_host else None),
                threshold=1,
                window_seconds=30,  # Mis à jour à 30s
                details={
                    "raw_message": raw_msg,
                    "anomaly_score": float(row.get("anomaly_score", 0.0)),
                    "log_type": str(row.get("log_type", "unknown")),
                    "host": str(log_host) if log_host else "unknown"
                },
                is_active=True,
                source_log_ids={"es_index": "siem-logs", "detected_at": datetime.utcnow().isoformat()}
            )
            db.add(ueba_rule)
            
            # 4b. Création de l'alerte opérationnelle SOC liée à cette règle
            ueba_alert = Alert(
                id=uuid.uuid4(),
                alert_id=f"ALT-UEBA-{uuid.uuid4().hex[:8].upper()}",
                rule_id=rule_id,
                severity=severity_enum,
                status=AlertStatus.NEW,
                created_at=datetime.utcnow()
            )
            db.add(ueba_alert)

        # Commit global du batch d'anomalies réelles
        db.commit()
        logger.info("Cycle UEBA : Persistance PostgreSQL réussie avec succès.")

    except Exception as e:
        db.rollback()
        logger.error("Échec critique lors du cycle de détection UEBA : %s", str(e), exc_info=True)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Gestionnaire de Tâches Asynchrones (APScheduler)
# ---------------------------------------------------------------------------
scheduler = BackgroundScheduler(timezone="UTC")
scheduler.add_job(
    execute_ueba_detection_cycle,
    trigger="interval",
    seconds=30,  # ⏱️ Déclenchement toutes les 30 secondes
    id="ueba_continuous_detection"
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Contrôle le démarrage, la création des tables et l'arrêt propre du démon."""
    # Création automatique des tables manquantes dans PostgreSQL à chaque démarrage
    logger.info("Vérification et création automatique des tables PostgreSQL...")
    Base.metadata.create_all(bind=engine)
    
    logger.info("Démarrage du démon de planification UEBA (Toutes les 30 secondes).")
    scheduler.start()
    yield
    logger.info("Arrêt propre du démon de planification UEBA.")
    scheduler.shutdown()

# Initialisation de l'API REST FastAPI
app = FastAPI(
    title="Smart SIEM - Module d'Analyse Comportementale UEBA",
    version="1.0.0",
    lifespan=lifespan
)


# ---------------------------------------------------------------------------
# Endpoints REST
# ---------------------------------------------------------------------------
@app.post("/api/v1/ueba/trigger", status_code=202)
async def trigger_manual_detection(background_tasks: BackgroundTasks):
    """
    Déclenche instantanément une analyse comportementale sur les données Elasticsearch
    de manière asynchrone pour ne pas bloquer l'appel de l'API.
    """
    logger.info("Requête reçue : Déclenchement manuel d'analyse UEBA.")
    background_tasks.add_task(execute_ueba_detection_cycle)
    return {
        "status": "accepted",
        "message": "Le cycle d'analyse UEBA a été délégué aux tâches de fond.",
        "requested_at": datetime.utcnow().isoformat()
    }


@app.get("/api/v1/ueba/status")
async def get_service_status():
    """Retourne l'état de santé opérationnel du moteur d'IA."""
    try:
        detector = get_detector()
        return {
            "service": "smart-siem-ueba",
            "scheduler_active": scheduler.running,
            "model_loaded": detector.is_loaded,
            "monitored_features": detector._loaded_feature_names,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=503, 
            detail=f"Le service UEBA est indisponible ou non initialisé : {str(e)}"
        )