"""
Chargement et validation du fichier config.yaml.

Ce module est volontairement simple : il lit le YAML, verifie que les
champs obligatoires sont presents, et renvoie un objet Python facile a
manipuler (Config) plutot qu'un simple dictionnaire.
"""

from dataclasses import dataclass
import yaml


# Champs qui doivent obligatoirement exister dans config.yaml.
# Si l'un d'eux manque, on prefere arreter l'agent tout de suite avec un
# message clair plutot que de planter plus tard avec une erreur obscure.
CHAMPS_OBLIGATOIRES = ["server_url", "host", "dest_ip", "watched_files"]


@dataclass
class FichierSurveille:
    """Represente une entree de la liste watched_files du config.yaml."""
    path: str
    parser: str


@dataclass
class Config:
    """Configuration complete de l'agent, une fois chargee et validee."""
    server_url: str
    host: str
    dest_ip: str
    watched_files: list[FichierSurveille]
    queue_file: str
    retry_interval: int


def charger_config(chemin_fichier: str = "config.yaml") -> Config:
    """Lit config.yaml et renvoie un objet Config pret a l'emploi."""

    with open(chemin_fichier, "r", encoding="utf-8") as f:
        donnees = yaml.safe_load(f)

    for champ in CHAMPS_OBLIGATOIRES:
        if champ not in donnees:
            raise ValueError(
                f"Champ obligatoire manquant dans {chemin_fichier} : '{champ}'"
            )

    fichiers = [
        FichierSurveille(path=entry["path"], parser=entry["parser"])
        for entry in donnees["watched_files"]
    ]

    return Config(
        server_url=donnees["server_url"],
        host=donnees["host"],
        dest_ip=donnees["dest_ip"],
        watched_files=fichiers,
        # Valeurs par defaut si absentes du YAML, pour rester tolerant.
        queue_file=donnees.get("queue_file", "/var/log/siem-agent/queue.jsonl"),
        retry_interval=donnees.get("retry_interval", 10),
    )
