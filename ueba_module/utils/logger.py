"""
utils/logger.py
Fournit un logger unique et cohérent pour tout le module : sortie console +
fichier avec rotation, format horodaté, niveau piloté par .env. Tous les
autres fichiers font `from utils.logger import get_logger`.
"""
from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler

from config import LOGGING_CONFIG

_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

_initialized_loggers: dict[str, logging.Logger] = {}


def get_logger(name: str) -> logging.Logger:
    """Retourne un logger configuré et idempotent pour le module `name`."""
    if name in _initialized_loggers:
        return _initialized_loggers[name]

    LOGGING_CONFIG.log_dir.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger(name)
    logger.setLevel(LOGGING_CONFIG.level.upper())
    logger.propagate = False

    if not logger.handlers:
        formatter = logging.Formatter(_FORMAT, datefmt=_DATE_FORMAT)

        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

        file_handler = RotatingFileHandler(
            LOGGING_CONFIG.log_dir / "ueba_module.log",
            maxBytes=10 * 1024 * 1024,  # 10 Mo
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    _initialized_loggers[name] = logger
    return logger
