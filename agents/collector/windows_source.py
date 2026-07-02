"""
Lecture du Journal d'evenements Windows via PowerShell (Get-WinEvent).

Pourquoi PowerShell en sous-processus plutot qu'une lib native (pywin32) :
  - aucune dependance a installer, code simple a deboguer,
  - on peut tester la meme requete a la main.

Le canal "Security" n'est lisible qu'en administrateur : l'agent doit donc
etre lance depuis un terminal eleve.

Fonctionnement : a chaque passage, on demande les N derniers evenements du
canal, et on ne garde que ceux dont le RecordId depasse le dernier vu (filigrane).
Au tout premier passage, on memorise la position courante sans renvoyer
l'historique, pour ne pas noyer l'API avec de vieux evenements au demarrage.
"""

import json
import subprocess


def _construire_script(channel: str, event_ids: list[int], max_events: int = 200) -> str:
    """Construit le script PowerShell qui sort un evenement par ligne (JSON)."""
    ids = ",".join(str(i) for i in event_ids)
    return (
        "$ErrorActionPreference='Stop'; "
        "try { $events = Get-WinEvent -FilterHashtable @{LogName='" + channel + "'; "
        "Id=@(" + ids + ")} -MaxEvents " + str(max_events) + " } catch { exit }; "
        "foreach ($e in $events) { "
        "$xml=[xml]$e.ToXml(); $data=@{}; "
        "foreach ($d in $xml.Event.EventData.Data) { if ($d.Name) { $data[$d.Name]=[string]$d.'#text' } }; "
        "if ($xml.Event.UserData -and $xml.Event.UserData.HasChildNodes) { "
        "foreach ($c in $xml.Event.UserData.FirstChild.ChildNodes) { $data[$c.LocalName]=[string]$c.'#text' } }; "
        "[pscustomobject]@{ RecordId=[long]$e.RecordId; Id=[int]$e.Id; "
        "TimeCreated=$e.TimeCreated.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'); "
        "EventData=$data } | ConvertTo-Json -Depth 4 -Compress }"
    )


def _executer_powershell(script: str) -> str:
    try:
        resultat = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
            capture_output=True, text=True, timeout=30,
        )
    except (subprocess.TimeoutExpired, OSError):
        return ""
    return resultat.stdout or ""


def _parser_lignes_json(stdout: str) -> list[dict]:
    """Chaque evenement est une ligne JSON compacte (JSON Lines)."""
    evenements = []
    for ligne in stdout.splitlines():
        ligne = ligne.strip()
        if not ligne:
            continue
        try:
            evenements.append(json.loads(ligne))
        except json.JSONDecodeError:
            continue
    return evenements


class WindowsEventSource:
    """Interroge un ou plusieurs canaux du Journal et renvoie les nouveautes."""

    def __init__(self, canaux: list[dict]):
        # canaux : [{"channel": "Security", "event_ids": [4625, ...]}, ...]
        self.canaux = canaux
        self._filigrane: dict[str, int] = {}  # channel -> dernier RecordId vu

    def poll(self) -> list[dict]:
        """Renvoie tous les nouveaux evenements, triples chronologiquement."""
        nouveaux = []
        for c in self.canaux:
            nouveaux.extend(self._poll_canal(c["channel"], c["event_ids"]))
        return nouveaux

    def _poll_canal(self, channel: str, event_ids: list[int]) -> list[dict]:
        script = _construire_script(channel, event_ids)
        evenements = _parser_lignes_json(_executer_powershell(script))
        if not evenements:
            return []

        record_max = max(e.get("RecordId", 0) for e in evenements)

        # Premier passage : on se cale sur la position courante sans historique.
        if channel not in self._filigrane:
            self._filigrane[channel] = record_max
            return []

        seuil = self._filigrane[channel]
        nouveaux = [e for e in evenements if e.get("RecordId", 0) > seuil]
        self._filigrane[channel] = max(seuil, record_max)
        nouveaux.sort(key=lambda e: e.get("RecordId", 0))  # du plus ancien au plus recent
        return nouveaux
