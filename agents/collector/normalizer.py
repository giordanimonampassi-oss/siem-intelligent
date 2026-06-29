"""
Normalisation : transforme un LogParse (sortie d'un parser) en JSON final
conforme au contrat defini avec le Backend (voir agents/PIPELINE.md).

Le normalizer est le seul endroit du code qui decide du niveau de
"severity". Les regles appliquees correspondent exactement aux tableaux
valides avec le Backend dans PIPELINE.md.
"""

import re

from parsers.base import LogParse


# Code HTTP attendu en fin de ligne Apache : ... "GET / HTTP/1.1" 200 10982
REGEX_CODE_HTTP = re.compile(r'"\s+(?P<code>\d{3})\s+\d+')


def normaliser(parsed: LogParse, host: str, dest_ip: str) -> dict:
    """Construit le dictionnaire final pret a etre envoye a l'API."""

    severite = _calculer_severite(parsed)

    return {
        "timestamp": parsed.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_ip": parsed.source_ip,
        "dest_ip": dest_ip,
        "host": host,
        "username": parsed.username,
        "log_type": parsed.log_type,
        "severity": severite,
        "raw_message": parsed.raw_message,
        "batch_id": None,
    }


def _calculer_severite(parsed: LogParse) -> str:
    """Choisit le niveau de severite selon le type et le contenu du log."""

    if parsed.log_type == "auth":
        return _severite_auth(parsed)

    if parsed.log_type == "application":
        return _severite_web(parsed.raw_message)

    if parsed.log_type == "system":
        # Activite systeme routiniere (ex: cron) : pas une alerte de
        # securite en soi, mais on la garde pour la tracabilite.
        return "info"

    # Type de log sans regle specifique encore definie (ex: "network"
    # pour le simulateur Cisco) : on reste prudent par defaut.
    return "warning"


def _severite_auth(parsed: LogParse) -> str:
    message = parsed.raw_message

    if "POSSIBLE BREAK-IN ATTEMPT" in message:
        return "critical"

    if "Failed password" in message:
        return "critical" if parsed.username == "root" else "warning"

    if "Invalid user" in message:
        return "warning"

    # "high" n'existe pas dans LogSeverity (3 niveaux : info/warning/critical) ;
    # c'est un niveau reserve aux alertes (AlertSeverity). On reste en warning.
    if "authentication failure" in message:
        return "warning"

    if "session opened for user root" in message:
        return "warning"

    if "Accepted password" in message or "Accepted publickey" in message:
        return "info"

    # Ligne auth.log reconnue mais sans regle de severite specifique.
    return "info"


def _severite_web(message: str) -> str:
    correspondance = REGEX_CODE_HTTP.search(message)
    if not correspondance:
        return "warning"

    code = int(correspondance.group("code"))

    # LogSeverity n'a que 3 niveaux (info/warning/critical) : "high" est reserve
    # aux alertes. Les erreurs HTTP (4xx dont 403, 5xx) restent donc en warning,
    # le 2xx/3xx en info.
    if code >= 400:
        return "warning"
    return "info"
