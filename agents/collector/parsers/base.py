"""
Interface commune a tous les parsers.

Chaque parser (auth_parser, apache_parser, ...) recoit une ligne de log
brute et essaie d'en extraire les informations utiles. Le watcher n'a
jamais besoin de savoir QUEL parser il utilise : il appelle juste
parse(ligne) et obtient soit un LogParse, soit None si la ligne ne
correspond a rien d'interessant.
"""

from dataclasses import dataclass
from datetime import datetime


@dataclass
class LogParse:
    """Resultat de l'analyse d'une ligne de log par un parser."""
    timestamp: datetime
    source_ip: str | None
    username: str | None
    raw_message: str
    log_type: str  # "auth", "web", "network", "system"


class Parser:
    """Classe de base : chaque parser concret doit redefinir parse()."""

    def parse(self, ligne: str) -> LogParse | None:
        raise NotImplementedError("Chaque parser doit implementer parse()")
