"""
models/anomaly_detector.py

CONFRONTATION : charge le modèle et le scaler sauvegardés par
baseline_trainer.py, les applique sur les features produites par
agent_pipeline.py, et retourne un DataFrame enrichi avec :
  - anomaly_label  : +1 (normal) ou -1 (anomalie)
  - anomaly_score  : score de décision brut (plus négatif = plus suspect)
  - is_anomaly     : booléen True si anomalie confirmée

Le DataFrame retourné est aligné sur le raw_df d'origine (même index).
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from config import MODEL_CONFIG, PIPELINE_CONFIG
from pipeline.common_features import FEATURE_COLUMNS, select_model_input
from utils.logger import get_logger

logger = get_logger(__name__)


class AnomalyDetector:
    """
    Encapsule le modèle et le scaler pour être instancié une seule fois et
    réutilisé à chaque cycle de détection.
    """

    def __init__(self) -> None:
        self._model: IsolationForest | None = None
        self._scaler: StandardScaler | None = None
        self._loaded_feature_names: list[str] = []

    def load(self) -> None:
        """Charge le modèle, le scaler, et vérifie la cohérence des features."""
        if not MODEL_CONFIG.model_path.exists():
            raise FileNotFoundError(
                f"Modèle introuvable : {MODEL_CONFIG.model_path}. "
                f"Lance d'abord baseline_trainer.py."
            )
        if not MODEL_CONFIG.scaler_path.exists():
            raise FileNotFoundError(
                f"Scaler introuvable : {MODEL_CONFIG.scaler_path}. "
                f"Lance d'abord baseline_trainer.py."
            )

        self._model = joblib.load(MODEL_CONFIG.model_path)
        self._scaler = joblib.load(MODEL_CONFIG.scaler_path)
        logger.info("Modèle et scaler chargés depuis saved_models/")

        # ── Vérification de dérive de features ──────────────────────────────
        if MODEL_CONFIG.feature_names_path.exists():
            with open(MODEL_CONFIG.feature_names_path) as f:
                self._loaded_feature_names = json.load(f)

            if self._loaded_feature_names != FEATURE_COLUMNS:
                drift = set(self._loaded_feature_names) ^ set(FEATURE_COLUMNS)
                raise ValueError(
                    f"FEATURE DRIFT DÉTECTÉ — les features du modèle chargé "
                    f"diffèrent de FEATURE_COLUMNS actuel. "
                    f"Colonnes divergentes : {drift}. "
                    f"Réentraîne le modèle avant de relancer la détection."
                )
            logger.info("Cohérence des features vérifiée : OK (%d features)", len(FEATURE_COLUMNS))
        else:
            logger.warning(
                "feature_names.json absent — vérification de dérive ignorée. "
                "Recommande de réentraîner le modèle."
            )

    @property
    def is_loaded(self) -> bool:
        return self._model is not None and self._scaler is not None

    def predict(self, features_df: pd.DataFrame) -> pd.DataFrame:
        """
        Applique le scaler puis le modèle sur les features et retourne le
        DataFrame d'entrée enrichi de trois colonnes.
        """
        if not self.is_loaded:
            raise RuntimeError("Appelle load() avant predict().")

        if features_df.empty:
            logger.warning("predict() appelé sur un DataFrame vide — retour vide")
            return features_df.assign(
                anomaly_label=pd.Series(dtype=int),
                anomaly_score=pd.Series(dtype=float),
                is_anomaly=pd.Series(dtype=bool),
            )

        # S'assurer de l'ordre exact des colonnes avant le scaler
        X = select_model_input(features_df).values
        X_scaled = self._scaler.transform(X)

        labels = self._model.predict(X_scaled)           # +1 ou -1
        scores = self._model.decision_function(X_scaled) # plus négatif = plus suspect

        result = features_df.copy()
        result["anomaly_label"] = labels
        result["anomaly_score"] = scores
        result["is_anomaly"] = (
            (labels == -1)
            & (scores < MODEL_CONFIG.anomaly_score_threshold)
        )

        n_anomalies = result["is_anomaly"].sum()
        logger.info(
            "Scoring terminé : %d / %d logs flaggés comme anomalies (%.1f%%)",
            n_anomalies, len(result), n_anomalies / len(result) * 100,
        )
        return result

    def predict_with_context(
        self, raw_df: pd.DataFrame, features_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Recolle les colonnes contextuelles au résultat de scoring pour produire
        un rapport d'alertes exploitable par le SOC ou le dashboard React.
        """
        scored = self.predict(features_df)
        anomalies = scored[scored["is_anomaly"]].copy()

        if anomalies.empty:
            logger.info("Aucune anomalie détectée sur ce batch")
            return pd.DataFrame()

        # Recoller sécurisé du contexte brut sur les mêmes index présents dans les deux tables
        context_cols = [
            c for c in ["timestamp", "source_ip", "dest_ip", "host",
                        "username", "log_type", "severity", "raw_message"]
            if c in raw_df.columns
        ]
        
        common_indices = anomalies.index.intersection(raw_df.index)
        context = raw_df.loc[common_indices, context_cols]
        anomalies_filtered = anomalies.loc[common_indices, ["anomaly_label", "anomaly_score", "is_anomaly"]]

        report = pd.concat(
            [context.reset_index(drop=True), anomalies_filtered.reset_index(drop=True)],
            axis=1,
        )

        # Sauvegarde locale dans data/3_anomalies/
        _persist_anomalies(report)

        logger.info(
            "Rapport d'anomalies produit : %d alertes", len(report)
        )
        return report


def _persist_anomalies(report: pd.DataFrame) -> None:
    """Sauvegarde les anomalies en CSV horodaté dans data/3_anomalies/."""
    if report.empty:
        return

    out_dir = PIPELINE_CONFIG.anomalies_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    ts = pd.Timestamp.now().strftime("%Y%m%d_%H%M%S")
    out_path = out_dir / f"anomalies_{ts}.csv"
    report.to_csv(out_path, index=False)
    logger.info("Anomalies persistées : %s", out_path)


# ── Singleton partagé, chargé une seule fois au démarrage ─────────────────
_detector_instance: AnomalyDetector | None = None


def get_detector() -> AnomalyDetector:
    """Retourne le singleton AnomalyDetector, chargé à la première demande."""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = AnomalyDetector()
        _detector_instance.load()
    return _detector_instance


if __name__ == "__main__":
    print("Test de l'initialisation du détecteur...")
    try:
        detector = get_detector()
        print("Initialisation réussie ! Prêt pour la production.")
    except Exception as e:
        print(f"Erreur d'initialisation : {e}")