"""
Chargement et validation du fichier config.yaml.

Ce module est volontairement simple : il lit le YAML, verifie que les
champs obligatoires sont presents, et renvoie un objet Python facile a
manipuler (Config) plutot qu'un simple dictionnaire.
"""

from dataclasses import dataclass
import os

import yaml

# Charge un eventuel fichier .env (gitignore) du dossier courant, pour y lire
# le mot de passe du compte agent (SIEM_AGENT_PASSWORD). python-dotenv est
# optionnel : si absent, on se rabat sur les variables d'environnement reelles.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


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
    # Chemin vers le certificat du serveur si celui-ci est auto-signe
    # (cas du mock server en TLS). None = verification standard (CA reconnue).
    ca_cert: str | None
    # Authentification a la vraie API. None sur les deux si on cible un mock
    # sans auth. Le mot de passe vient de l'environnement, jamais du YAML.
    auth_url: str | None
    api_user: str | None
    api_password: str | None


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

    auth_url = donnees.get("auth_url")
    api_password = os.environ.get("SIEM_AGENT_PASSWORD")

    # Si on cible la vraie API (auth_url defini), le mot de passe est
    # obligatoire : on arrete tout de suite avec un message clair.
    if auth_url and not api_password:
        raise ValueError(
            "auth_url est defini mais la variable d'environnement "
            "SIEM_AGENT_PASSWORD est absente (mot de passe du compte agent). "
            "Cree un fichier .env avec SIEM_AGENT_PASSWORD=... (voir .env.example)."
        )

    return Config(
        server_url=donnees["server_url"],
        host=donnees["host"],
        dest_ip=donnees["dest_ip"],
        watched_files=fichiers,
        # Valeurs par defaut si absentes du YAML, pour rester tolerant.
        queue_file=donnees.get("queue_file", "/var/log/siem-agent/queue.jsonl"),
        retry_interval=donnees.get("retry_interval", 10),
        ca_cert=donnees.get("ca_cert"),
        auth_url=auth_url,
        api_user=donnees.get("api_user"),
        api_password=api_password,
    )
