"""
Parser pour le Journal d'evenements Windows (canal Security).

Contrairement aux parsers Linux qui recoivent une ligne de texte, celui-ci
recoit un evenement deja structure (dict issu de Get-WinEvent, voir
windows_source.py) : { "Id", "TimeCreated", "RecordId", "EventData": {...} }.

Les champs de EventData portent des noms stables et independants de la langue
de Windows (TargetUserName, IpAddress, LogonType...), car ils viennent du XML
de l'evenement, pas du message localise.

EventIDs suivis (alignes sur les scenarios MITRE du cahier des charges) :
  4625 - echec de connexion            -> T1110 Brute Force
  4624 - connexion reussie             -> contexte mouvement lateral
  4776 - validation credential NTLM    -> T1550 Pass-the-Hash (scenario S6)
  4672 - privileges speciaux (admin)   -> escalade
  1102 - journal d'audit efface        -> T1070 Log Deletion (Defense Evasion)
"""

from datetime import datetime, timezone

from .base import LogParse, Parser


# Severity dans l'echelle des logs (info/warning/critical). "high" n'existe
# pas au niveau log : c'est un niveau d'alerte (voir normalizer.py).
SEVERITE_PAR_EVENT = {
    4625: "warning",
    4624: "info",
    4776: "warning",
    4672: "warning",
    1102: "critical",
}

# 1102 (effacement du journal) est une activite systeme, le reste est de l'auth.
LOGTYPE_PAR_EVENT = {
    4625: "auth",
    4624: "auth",
    4776: "auth",
    4672: "auth",
    1102: "system",
}

# Valeurs d'Ip "locales" a considerer comme "pas d'IP source distante".
IP_LOCALES = {"-", "", "::1", "127.0.0.1"}

# Comptes systeme/service : leurs logons (4624 type 5) et privileges (4672)
# se declenchent en continu en arriere-plan -> bruit de fond a ne pas remonter.
COMPTES_SERVICE = {"SYSTEM", "LOCAL SERVICE", "NETWORK SERVICE", "ANONYMOUS LOGON"}

# LogonTypes interessants pour un 4624 (logon reussi) : 3 = reseau (mouvement
# lateral), 10 = RemoteInteractive/RDP. Les autres (4 batch, 5 service, 7 unlock,
# 11 cached...) sont routiniers et bruyants.
LOGON_TYPES_UTILES = {"3", "10"}


class WindowsEventParser(Parser):
    """Extrait les informations utiles d'un evenement Windows Security."""

    def parse(self, event: dict) -> LogParse | None:
        event_id = event.get("Id")
        if event_id not in SEVERITE_PAR_EVENT:
            return None  # Evenement non suivi : on l'ignore.

        data = event.get("EventData") or {}

        if self._est_bruit(event_id, data):
            return None  # Activite systeme routiniere : on ne remonte pas.

        return LogParse(
            timestamp=self._parse_timestamp(event.get("TimeCreated")),
            source_ip=self._extraire_ip(data),
            username=self._extraire_utilisateur(event_id, data),
            raw_message=self._construire_message(event_id, data),
            log_type=LOGTYPE_PAR_EVENT[event_id],
            severity=SEVERITE_PAR_EVENT[event_id],
        )

    @staticmethod
    def _est_bruit(event_id: int, data: dict) -> bool:
        """Filtre le bruit de fond Windows (logons/privileges des comptes service).

        Ne s'applique qu'aux evenements bruyants (4624, 4672). Les echecs (4625),
        NTLM (4776) et effacement du journal (1102) remontent toujours.
        """
        if event_id not in (4624, 4672):
            return False

        user = (data.get("TargetUserName") or data.get("SubjectUserName") or "")
        if user.endswith("$") or user.upper() in COMPTES_SERVICE:
            return True

        if event_id == 4624 and data.get("LogonType") not in LOGON_TYPES_UTILES:
            return True

        return False

    @staticmethod
    def _parse_timestamp(valeur: str | None) -> datetime:
        """TimeCreated arrive deja en UTC au format 'AAAA-MM-JJTHH:MM:SSZ'."""
        if not valeur:
            return datetime.now(timezone.utc)
        return datetime.strptime(valeur, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)

    @staticmethod
    def _extraire_ip(data: dict) -> str | None:
        ip = (data.get("IpAddress") or "").strip()
        if ip in IP_LOCALES:
            return None
        return ip

    @staticmethod
    def _extraire_utilisateur(event_id: int, data: dict) -> str | None:
        # 1102 : l'auteur de l'effacement est dans SubjectUserName.
        # Les logons : la cible est TargetUserName (a defaut SubjectUserName).
        if event_id == 1102:
            nom = data.get("SubjectUserName")
        else:
            nom = data.get("TargetUserName") or data.get("SubjectUserName")
        nom = (nom or "").strip()
        return nom or None

    @staticmethod
    def _construire_message(event_id: int, data: dict) -> str:
        """Message compact et lisible, construit a partir des champs du XML."""
        user = data.get("TargetUserName") or data.get("SubjectUserName") or "?"
        ip = data.get("IpAddress") or "-"
        logon_type = data.get("LogonType") or "?"

        if event_id == 4625:
            return (f"Windows 4625 Failed logon user={user} ip={ip} "
                    f"logon_type={logon_type} status={data.get('Status', '?')}")
        if event_id == 4624:
            return (f"Windows 4624 Successful logon user={user} ip={ip} "
                    f"logon_type={logon_type}")
        if event_id == 4776:
            return (f"Windows 4776 NTLM credential validation user={user} "
                    f"workstation={data.get('Workstation', '?')} "
                    f"status={data.get('Status', '?')}")
        if event_id == 4672:
            return f"Windows 4672 Special privileges assigned to user={user}"
        if event_id == 1102:
            return (f"Windows 1102 Security audit log cleared by "
                    f"user={data.get('SubjectUserName', '?')}")
        return f"Windows {event_id}"
