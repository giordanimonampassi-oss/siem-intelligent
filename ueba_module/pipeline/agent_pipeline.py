"""
pipeline/agent_pipeline.py

PIPELINE DYNAMIQUE : extrait les logs récents d'Elasticsearch et les convertit 
en caractéristiques textuelles numériques compatibles avec l'Isolation Forest.
"""
from __future__ import annotations

import json
import warnings
import pandas as pd

# Supprimer le message d'avertissement non bloquant de scikit-learn sur les features names
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn.*")

from pipeline.es_extractor import extract_recent_logs
from pipeline.common_features import build_features_from_logs
from config import MODEL_CONFIG
from utils.logger import get_logger

logger = get_logger(__name__)


def _align_features(df: pd.DataFrame) -> pd.DataFrame:
    """Réordonne et valide les colonnes selon le fichier feature_names.json du modèle."""
    try:
        if MODEL_CONFIG.feature_names_path.exists():
            with open(MODEL_CONFIG.feature_names_path, "r", encoding="utf-8") as f:
                expected_features = json.load(f)
            
            # S'assurer que toutes les colonnes attendues existent
            for col in expected_features:
                if col not in df.columns:
                    df[col] = 0.0
                    
            # Forcer l'ordre exact attendu par le StandardScaler
            return df[expected_features]
    except Exception as e:
        logger.warning("Impossible d'aligner explicitement les features : %s", str(e))
    return df


def run_agent_pipeline(window_minutes: int | None = None) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Exécute le flux d'ingestion de production :
      1. Extraction des logs récents de la base (ES / Elasticsearch)
      2. Extraction des caractéristiques textuelles numériques
      3. Alignement des colonnes avec le modèle de production
      
    Returns:
        tuple (raw_df, features_df) alignés sur le même index.
    """
    raw_df = extract_recent_logs(window_minutes=window_minutes)

    if raw_df.empty:
        logger.warning("Pipeline agent : aucun log récupéré depuis Elasticsearch à traiter")
        return raw_df, pd.DataFrame()

    raw_df = raw_df.reset_index(drop=True)
    
    # Extraction des caractéristiques via le nouveau contrat strict
    features_df = build_features_from_logs(raw_df)
    features_df.index = raw_df.index

    # Aligner l'ordre des colonnes avec le scaler sauvé (.json)
    features_df = _align_features(features_df)

    logger.info("Pipeline agent : %d logs transformés → %d features numériques", len(raw_df), features_df.shape[1])
    return raw_df, features_df


if __name__ == "__main__":
    logger.info("Lancement d'un test à blanc du pipeline dynamique...")
    raw, features = run_agent_pipeline()
    if not features.empty:
        print("\nAperçu des caractéristiques extraites en direct :")
        print(features.head())