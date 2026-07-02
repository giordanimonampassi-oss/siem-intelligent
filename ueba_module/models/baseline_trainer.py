"""
models/baseline_trainer.py

ENTRAÎNEMENT : charge les features produites par dataset_pipeline.py
(baseline_logs.csv structuré à partir de Loghub) et entraîne un Isolation Forest.
Sauvegarde le modèle, le scaler et la liste ordonnée des features dans saved_models/.

Principes appliqués :
  - Le modèle est entraîné sur les caractéristiques numériques dérivées des logs textuels.
  - Le StandardScaler est entraîné en même temps et sauvegardé séparément.
  - Les noms et l'ordre des features sont persistés en JSON pour la cohérence à l'inférence.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

from config import MODEL_CONFIG
from pipeline.dataset_pipeline import build_baseline_features
from utils.logger import get_logger

logger = get_logger(__name__)


def _ensure_saved_models_dir() -> None:
    MODEL_CONFIG.model_path.parent.mkdir(parents=True, exist_ok=True)


def train(
    csv_path: Path | None = None,
    contamination: float | None = None,
    n_estimators: int | None = None,
    random_state: int | None = None,
) -> dict:
    """
    Pipeline complet d'entraînement :
      1. Chargement et extraction via dataset_pipeline.py
      2. Sélection des features numériques textuelles
      3. Split train / validation (80/20)
      4. Scaling StandardScaler
      5. Entraînement IsolationForest
      6. Sauvegarde du modèle, scaler et feature_names
    """
    contamination = contamination or MODEL_CONFIG.contamination
    n_estimators  = n_estimators  or MODEL_CONFIG.n_estimators
    random_state  = random_state  or MODEL_CONFIG.random_state

    # Liste des caractéristiques numériques à utiliser pour l'entraînement
    features_list = ["severity_encoded", "message_length"]

    # ── 1. Chargement features baseline ────────────────────────────────────
    logger.info("=== PHASE 1 : Chargement de la baseline Loghub ===")
    t0 = time.perf_counter()
    features_df = build_baseline_features(csv_path)
    logger.info("Baseline chargée : %d lignes (%.1fs)",
                len(features_df), time.perf_counter() - t0)

    # ── 2. Split train / validation ─────────────────────────────────────────
    logger.info("=== PHASE 2 : Split 80/20 ===")
    X_train, X_val = train_test_split(
        features_df,
        test_size=0.2,
        random_state=random_state,
        shuffle=True,
    )
    
    # Isolation des colonnes numériques uniquement pour le modèle
    X_train_numeric = X_train[features_list]
    X_val_numeric = X_val[features_list]
    
    logger.info("Train : %d lignes | Validation : %d lignes", len(X_train_numeric), len(X_val_numeric))

    # ── 3. Scaling ──────────────────────────────────────────────────────────
    logger.info("=== PHASE 3 : Normalisation StandardScaler ===")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_numeric)
    X_val_scaled   = scaler.transform(X_val_numeric)

    # ── 4. Entraînement ─────────────────────────────────────────────────────
    logger.info(
        "=== PHASE 4 : Entraînement IsolationForest (n_estimators=%d, contamination=%.3f) ===",
        n_estimators, contamination,
    )
    t1 = time.perf_counter()
    model = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        max_samples="auto",
        n_jobs=-1,
        random_state=random_state,
        verbose=0,
    )
    model.fit(X_train_scaled)
    train_duration = time.perf_counter() - t1
    logger.info("Entraînement terminé en %.2fs", train_duration)

    # ── 5. Évaluation sur la validation (Taux d'anomalies détectées) ────────
    logger.info("=== PHASE 5 : Évaluation des alertes (Validation) ===")
    val_preds = model.predict(X_val_scaled)
    # IsolationForest : +1 = normal, -1 = anomalie détectée
    n_anomalies = np.sum(val_preds == -1)
    anomaly_rate = n_anomalies / len(val_preds) * 100
    logger.info(
        "Anomalies relevées sur l'échantillon de validation : %d / %d (%.2f%%)",
        n_anomalies, len(val_preds), anomaly_rate,
    )

    # ── 6. Sauvegarde ───────────────────────────────────────────────────────
    logger.info("=== PHASE 6 : Sauvegarde des artefacts ===")
    _ensure_saved_models_dir()

    joblib.dump(model, MODEL_CONFIG.model_path)
    logger.info("Modèle sauvegardé : %s", MODEL_CONFIG.model_path)

    joblib.dump(scaler, MODEL_CONFIG.scaler_path)
    logger.info("Scaler sauvegardé : %s", MODEL_CONFIG.scaler_path)

    with open(MODEL_CONFIG.feature_names_path, "w") as f:
        json.dump(features_list, f, indent=2)
    logger.info("Noms de features sauvegardés : %s", MODEL_CONFIG.feature_names_path)

    # ── Résumé retourné ─────────────────────────────────────────────────────
    summary = {
        "n_train":               len(X_train_numeric),
        "n_val":                 len(X_val_numeric),
        "n_estimators":          n_estimators,
        "contamination":         contamination,
        "detected_anomaly_rate": round(anomaly_rate, 2),
        "train_duration_sec":    round(train_duration, 2),
        "model_path":            str(MODEL_CONFIG.model_path),
        "scaler_path":           str(MODEL_CONFIG.scaler_path),
    }
    logger.info("=== ENTRAÎNEMENT TERMINÉ ===\n%s", json.dumps(summary, indent=2))
    return summary


if __name__ == "__main__":
    result = train()
    print("\nRésumé entraînement :")
    print(json.dumps(result, indent=2))