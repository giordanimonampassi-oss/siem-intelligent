"""
Parser pour /var/log/apache2/access.log (format "combined", defaut Apache).

Format d'une ligne typique :
    192.168.6.1 - - [26/Jun/2026:13:55:11 +0000] "GET / HTTP/1.1" 200 10982 "-" "Mozilla/5.0 ..."

Champs (dans l'ordre) : IP client, identd (ignore), utilisateur authentifie,
date, requete, code HTTP, taille reponse, referer, user-agent.
"""

import re
from datetime import datetime, timezone

from .base import LogParse, Parser


# Ligne complete au format "combined".
REGEX_LIGNE = re.compile(
    r'^(?P<ip>\S+)\s+\S+\s+(?P<user>\S+)\s+'
    r'\[(?P<date>[^\]]+)\]\s+'
    r'"(?P<requete>[^"]*)"\s+'
    r'(?P<code>\d{3})\s+(?P<taille>\S+)'
)

# Le format Apache pour la date ne contient pas de separateur standard ISO :
# "26/Jun/2026:13:55:11 +0000"
FORMAT_DATE_APACHE = "%d/%b/%Y:%H:%M:%S %z"


class ApacheParser(Parser):
    """Extrait les requetes HTTP depuis access.log (format combined)."""

    def parse(self, ligne: str) -> LogParse | None:
        correspondance = REGEX_LIGNE.match(ligne)
        if not correspondance:
            # Ligne qui ne respecte pas le format "combined" attendu : on l'ignore.
            return None

        utilisateur = correspondance.group("user")
        if utilisateur == "-":
            # "-" signifie qu'aucun utilisateur n'a ete authentifie (cas normal,
            # la plupart des requetes HTTP ne passent pas par une auth Apache).
            utilisateur = None

        return LogParse(
            timestamp=self._construire_timestamp(correspondance.group("date")),
            source_ip=correspondance.group("ip"),
            username=utilisateur,
            raw_message=ligne.strip(),
            # Le backend classe les logs web dans la categorie "application"
            # (LogType n'a pas de valeur "web").
            log_type="application",
        )

    @staticmethod
    def _construire_timestamp(date_apache: str) -> datetime:
        """Parse le format de date Apache et le convertit en UTC."""
        return datetime.strptime(date_apache, FORMAT_DATE_APACHE).astimezone(timezone.utc)
