"""
Parser pour /var/log/auth.log (authentification SSH / sudo sur Linux).

Format d'une ligne typique :
    Jun 24 14:32:45 ctu-auth sshd[1338]: Failed password for root from 192.168.6.1 port 44231 ssh2

Le format syslog classique ne contient pas l'annee dans le timestamp.
On la deduit de la date du jour (limitation acceptee pour ce projet :
l'horloge de la VM doit etre correctement reglee).
"""

import re
from datetime import datetime

from .base import LogParse, Parser


# Ligne complete : "Mois Jour HH:MM:SS hostname process[pid]: message"
REGEX_LIGNE = re.compile(
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
        correspondance = REGEX_LIGNE.match(ligne)
        if not correspondance:
            # Ligne qui ne respecte pas le format syslog attendu : on l'ignore.
            return None

        message = correspondance.group("message")
        timestamp = self._construire_timestamp(correspondance.group("date"))

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
    def _construire_timestamp(date_sans_annee: str) -> datetime:
        """Ajoute l'annee courante a un timestamp syslog ("Jun 24 14:32:45")."""
        annee_courante = datetime.now().year
        return datetime.strptime(f"{annee_courante} {date_sans_annee}", "%Y %b %d %H:%M:%S")
