"""
Parser pour /var/log/auth.log (authentification SSH / sudo sur Linux).

Ubuntu 22.04+ utilise par defaut le template rsyslog "RSYSLOG_FileFormat",
qui ecrit un timestamp ISO 8601 complet (avec annee et fuseau horaire) :
    2026-06-27T08:15:45.801672+00:00 ctu-auth sshd[1399]: Failed password for ...

On garde aussi en secours l'ancien format syslog classique (sans annee,
utilise par certaines distributions plus anciennes) :
    Jun 24 14:32:45 ctu-auth sshd[1338]: Failed password for root from 192.168.6.1 port 44231 ssh2
"""

import re
from datetime import datetime, timezone

from .base import LogParse, Parser


# Ligne au format ISO 8601 (defaut Ubuntu 22.04+) :
# "AAAA-MM-JJTHH:MM:SS[.micro][+HH:MM|Z] hostname process[pid]: message"
REGEX_LIGNE_ISO = re.compile(
    r"^(?P<date>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z))\s+"
    r"(?P<host>\S+)\s+"
    r"(?P<process>[\w.\-]+)(\[\d+\])?:\s+"
    r"(?P<message>.*)$"
)

# Ligne au format syslog classique (sans annee) :
# "Mois Jour HH:MM:SS hostname process[pid]: message"
REGEX_LIGNE_CLASSIQUE = re.compile(
    r"^(?P<date>\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+"
    r"(?P<host>\S+)\s+"
    r"(?P<process>[\w.\-]+)(\[\d+\])?:\s+"
    r"(?P<message>.*)$"
)

# Tentative de connexion echouee avec mauvais mot de passe.
REGEX_FAILED_PASSWORD = re.compile(
    r"Failed password for (invalid user )?(?P<user>\S+) from (?P<ip>\S+) port"
)

# Tentative de connexion avec un utilisateur qui n'existe pas.
REGEX_INVALID_USER = re.compile(
    r"Invalid user (?P<user>\S+) from (?P<ip>\S+) port"
)

# Connexion reussie (mot de passe ou cle SSH).
REGEX_ACCEPTED = re.compile(
    r"Accepted (password|publickey) for (?P<user>\S+) from (?P<ip>\S+) port"
)


class AuthParser(Parser):
    """Extrait les evenements d'authentification depuis auth.log."""

    def parse(self, ligne: str) -> LogParse | None:
        correspondance = REGEX_LIGNE_ISO.match(ligne)
        if correspondance:
            timestamp = self._construire_timestamp_iso(correspondance.group("date"))
        else:
            correspondance = REGEX_LIGNE_CLASSIQUE.match(ligne)
            if not correspondance:
                # Ligne qui ne respecte aucun des deux formats attendus : on l'ignore.
                return None
            timestamp = self._construire_timestamp_classique(correspondance.group("date"))

        message = correspondance.group("message")

        # On essaie chaque type d'evenement connu, dans l'ordre.
        for regex in (REGEX_FAILED_PASSWORD, REGEX_INVALID_USER, REGEX_ACCEPTED):
            trouve = regex.search(message)
            if trouve:
                return LogParse(
                    timestamp=timestamp,
                    source_ip=trouve.group("ip"),
                    username=trouve.group("user"),
                    raw_message=message,
                    log_type="auth",
                )

        # La ligne est un vrai log auth.log mais ne correspond a aucun motif
        # connu (ex: demarrage du service). On la transmet quand meme avec
        # source_ip/username a null, pour ne perdre aucune information.
        return LogParse(
            timestamp=timestamp,
            source_ip=None,
            username=None,
            raw_message=message,
            log_type="auth",
        )

    @staticmethod
    def _construire_timestamp_iso(date_iso: str) -> datetime:
        """Parse un timestamp ISO 8601 et le convertit en UTC."""
        return datetime.fromisoformat(date_iso).astimezone(timezone.utc)

    @staticmethod
    def _construire_timestamp_classique(date_sans_annee: str) -> datetime:
        """Ajoute l'annee courante a un timestamp syslog ("Jun 24 14:32:45").

        Limitation acceptee pour ce projet : ce format ne contient pas le
        fuseau horaire, on suppose donc que l'horloge de la machine est en UTC.
        """
        annee_courante = datetime.now().year
        timestamp = datetime.strptime(f"{annee_courante} {date_sans_annee}", "%Y %b %d %H:%M:%S")
        return timestamp.replace(tzinfo=timezone.utc)
