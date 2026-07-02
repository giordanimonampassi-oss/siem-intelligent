"""
main.py

Point d'entrée du module UEBA. Trois modes d'exécution :

  python main.py train
        Entraîne le modèle sur le dataset défini dans la config (baseline_logs.csv).
        Options : --csv <path> --contamination 0.05 --estimators 200

  python main.py detect
        Lance une détection unique (un batch ES immédiat) et affiche le rapport.

  python main.py schedule
        Lance le scheduling automatique : détection toutes les N minutes
        (EXTRACTION_WINDOW_MINUTES dans .env). Mode daemon production.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from config import PIPELINE_CONFIG
from models.baseline_trainer import train
from models.anomaly_detector import get_detector
from pipeline.agent_pipeline import run_agent_pipeline
from utils.logger import get_logger

logger = get_logger("main")


def cmd_train(args: argparse.Namespace) -> None:
    """Lance l'entraînement complet."""
    result = train(
        csv_path=Path(args.csv) if args.csv else None,
        contamination=args.contamination,
        n_estimators=args.estimators,
    )
    logger.info("Entraînement terminé. Résumé : %s", result)


def cmd_detect_once() -> None:
    """Lance une détection immédiate sur le dernier batch ES."""
    logger.info("=== Détection batch unique ===")
    detector = get_detector()
    raw, features = run_agent_pipeline()

    if features.empty:
        logger.info("Aucun log à scorer — fin du cycle")
        return

    report = detector.predict_with_context(raw, features)

    if report.empty:
        logger.info("Aucune anomalie détectée sur ce batch")
    else:
        logger.info("%d anomalie(s) détectée(s)", len(report))
        # Sélection dynamique des colonnes présentes pour éviter les plantages à l'affichage
        display_cols = [c for c in ["timestamp", "source_ip", "username", "host", "severity", "anomaly_score"] if c in report.columns]
        print(report[display_cols].to_string(index=False))


def cmd_schedule() -> None:
    """
    Mode daemon : détection cyclique via APScheduler.
    Le modèle est chargé une seule fois (singleton get_detector()),
    seule l'extraction ES et le scoring sont répétés à chaque cycle.
    """
    try:
        from apscheduler.schedulers.blocking import BlockingScheduler
    except ImportError:
        logger.error("apscheduler non installé. Lance : pip install apscheduler")
        sys.exit(1)

    interval = PIPELINE_CONFIG.extraction_window_minutes
    logger.info("=== Mode scheduling : cycle toutes les %d minutes ===", interval)

    # Charge le modèle une seule fois avant le premier cycle
    get_detector()

    scheduler = BlockingScheduler(timezone="UTC")
    scheduler.add_job(
        cmd_detect_once,
        trigger="interval",
        minutes=interval,
        id="ueba_detection_cycle",
        replace_existing=True,
    )

    logger.info("Scheduler démarré. Ctrl+C pour arrêter.")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler arrêté proprement")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ueba_module",
        description="Module UEBA — Isolation Forest sur logs Elasticsearch (Loghub)",
    )
    sub = parser.add_subparsers(dest="command")

    # ── train ────────────────────────────────────────────────────────────────
    train_p = sub.add_parser("train", help="Entraîne le modèle sur la baseline")
    train_p.add_argument("--csv", type=str, default=None,
                         help="Chemin vers le fichier de baseline CSV (défaut : config)")
    train_p.add_argument("--contamination", type=float, default=None,
                         help="Taux de contamination Isolation Forest (défaut : config)")
    train_p.add_argument("--estimators", type=int, default=None,
                         help="Nombre d'arbres (défaut : config)")

    # ── detect ───────────────────────────────────────────────────────────────
    sub.add_parser("detect", help="Détection unique sur le batch ES courant")

    # ── schedule ─────────────────────────────────────────────────────────────
    sub.add_parser("schedule", help="Daemon de détection cyclique (production)")

    return parser


if __name__ == "__main__":
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "train":
        cmd_train(args)
    elif args.command == "detect":
        cmd_detect_once()
    elif args.command == "schedule":
        cmd_schedule()
    else:
        parser.print_help()
        sys.exit(0)