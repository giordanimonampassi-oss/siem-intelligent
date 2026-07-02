"""
Chargement de la config de l'agent Windows (config.windows.yaml).

Reprend les memes reglages de connexion que l'agent Linux (server_url, auth,
queue_file...), mais remplace "watched_files" par "watched_events" : les
canaux du Journal d'evenements et les EventIDs a surveiller.

Le mot de passe du compte agent est lu dans SIEM_AGENT_PASSWORD (fichier .env
gitignore), jamais dans le YAML.
"""

from dataclasses import dataclass
import os

import yaml

# Charge un eventuel .env du dossier courant pour SIEM_AGENT_PASSWORD.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


CHAMPS_OBLIGATOIRES = ["server_url", "host", "dest_ip", "watched_events"]


@dataclass
class CanalSurveille:
    """Un canal du Journal (ex: Security) et les EventIDs a en extraire."""
    channel: str
    event_ids: list[int]


@dataclass
class WindowsConfig:
    server_url: str
    host: str
    dest_ip: str
    watched_events: list[CanalSurveille]
    queue_file: str
    poll_interval: int
    ca_cert: str | None
    auth_url: str | None
    api_user: str | None
    api_password: str | None


def charger_config_windows(chemin_fichier: str = "config.windows.yaml") -> WindowsConfig:
    with open(chemin_fichier, "r", encoding="utf-8") as f:
        donnees = yaml.safe_load(f)

    for champ in CHAMPS_OBLIGATOIRES:
        if champ not in donnees:
            raise ValueError(
                f"Champ obligatoire manquant dans {chemin_fichier} : '{champ}'"
            )

    auth_url = donnees.get("auth_url")
    api_password = os.environ.get("SIEM_AGENT_PASSWORD")
    if auth_url and not api_password:
        raise ValueError(
            "auth_url est defini mais la variable d'environnement "
            "SIEM_AGENT_PASSWORD est absente (mot de passe du compte agent). "
            "Cree un fichier .env avec SIEM_AGENT_PASSWORD=... (voir .env.example)."
        )

    canaux = [
        CanalSurveille(channel=entry["channel"], event_ids=entry["event_ids"])
        for entry in donnees["watched_events"]
    ]

    return WindowsConfig(
        server_url=donnees["server_url"],
        host=donnees["host"],
        dest_ip=donnees["dest_ip"],
        watched_events=canaux,
        queue_file=donnees.get("queue_file", "C:/ProgramData/siem-agent/queue.jsonl"),
        poll_interval=donnees.get("poll_interval", 10),
        ca_cert=donnees.get("ca_cert"),
        auth_url=auth_url,
        api_user=donnees.get("api_user"),
        api_password=api_password,
    )
