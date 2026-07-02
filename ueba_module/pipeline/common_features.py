"""
pipeline/common_features.py

Contrat de features adapté au format de logs textuels (Loghub OpenSSH/Linux/Apache).
Centralise les caractéristiques numériques calculées à partir des chaînes de texte
brutes pour assurer la cohérence entre l'entraînement et l'inférence temps réel.
"""
from __future__ import annotations

import pandas as pd

from utils.logger import get_logger

logger = get_logger(__name__)

# Le contrat de features strict pour l'Isolation Forest
FEATURE_COLUMNS = [
    "severity_encoded",  # 1 si error, 0 sinon
    "message_length"     # Longueur du champ raw_message
]


def build_features_from_logs(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extrait et calcule les FEATURE_COLUMNS à partir des logs bruts du SIEM (log_entries).
    Appelé par agent_pipeline.py pour l'inférence en temps réel.
    """
    required = {"severity", "raw_message"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Colonnes log_entries manquantes pour l'extraction : {missing}")

    out = pd.DataFrame(index=df.index)

    # 1. Encodage de la sévérité (aligné sur dataset_pipeline.py)
    out["severity_encoded"] = df["severity"].fillna("info").apply(
        lambda x: 1 if str(x).strip().lower() in ["error", "critical", "failure"] else 0
    )

    # 2. Calcul de la longueur du message
    out["message_length"] = df["raw_message"].fillna("").str.len()

    return out[FEATURE_COLUMNS]


def select_model_input(df: pd.DataFrame) -> pd.DataFrame:
    """
    Point de passage obligé avant model.predict() ou scaler.transform().
    Garantit que l'ordre des colonnes numériques est strictement respecté.
    """
    missing = [c for c in FEATURE_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Features manquantes pour le modèle : {missing}")
    return df[FEATURE_COLUMNS].fillna(0).copy()