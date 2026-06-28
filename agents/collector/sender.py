"""
Envoi des logs normalises vers l'API centrale, avec resilience reseau.

Principe : si l'API ne repond pas (coupure reseau, serveur en panne), le
log n'est pas perdu. Il est ecrit dans un fichier de file d'attente
local (queue_file) et sera renvoye automatiquement plus tard, quand la
connexion sera retablie.
"""

import json
import os

import requests


class Sender:
    """Gere l'envoi HTTP des logs et la file d'attente locale."""

    def __init__(self, server_url: str, queue_file: str, timeout: int = 5, ca_cert: str | bool = True):
        self.server_url = server_url
        self.queue_file = queue_file
        self.timeout = timeout
        # True : verification standard (cas normal, certificat signe par une CA reconnue).
        # Chemin vers un .crt : verification contre ce certificat precis (cas du
        # certificat auto-signe du mock server, qui n'est dans aucune CA connue).
        self.ca_cert = ca_cert

        # On s'assure que le dossier de la file d'attente existe avant
        # d'essayer d'y ecrire quoi que ce soit.
        dossier = os.path.dirname(self.queue_file)
        if dossier:
            os.makedirs(dossier, exist_ok=True)

    def envoyer(self, log: dict) -> bool:
        """Tente d'envoyer un log. Le met en file d'attente si ca echoue."""
        if self._poster(log):
            return True

        self._mettre_en_file_attente(log)
        return False

    def rejouer_file_attente(self) -> None:
        """Retente l'envoi de tous les logs en attente.

        Les logs renvoyes avec succes sont retires de la file. Les
        autres restent en attente pour le prochain passage.
        """
        if not os.path.exists(self.queue_file):
            return

        with open(self.queue_file, "r", encoding="utf-8") as f:
            lignes_en_attente = [ligne.strip() for ligne in f if ligne.strip()]

        if not lignes_en_attente:
            return

        toujours_en_echec = []
        for ligne in lignes_en_attente:
            log = json.loads(ligne)
            if not self._poster(log):
                toujours_en_echec.append(ligne)

        self._reecrire_file_attente(toujours_en_echec)

    def _poster(self, log: dict) -> bool:
        """Envoie un seul log par HTTP POST. Renvoie True si accepte (2xx)."""
        try:
            reponse = requests.post(
                self.server_url, json=log, timeout=self.timeout, verify=self.ca_cert
            )
            return reponse.status_code in (200, 201)
        except requests.exceptions.RequestException:
            # Pas de connexion, timeout, DNS injoignable, etc.
            return False

    def _mettre_en_file_attente(self, log: dict) -> None:
        with open(self.queue_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log) + "\n")

    def _reecrire_file_attente(self, lignes_restantes: list[str]) -> None:
        with open(self.queue_file, "w", encoding="utf-8") as f:
            for ligne in lignes_restantes:
                f.write(ligne + "\n")
