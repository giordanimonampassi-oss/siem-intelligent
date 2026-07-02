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

    def __init__(self, server_url: str, queue_file: str, timeout: int = 5,
                 ca_cert: str | bool = True, auth_url: str | None = None,
                 api_user: str | None = None, api_password: str | None = None):
        self.server_url = server_url
        self.queue_file = queue_file
        self.timeout = timeout
        # True : verification standard (cas normal, certificat signe par une CA reconnue).
        # Chemin vers un .crt : verification contre ce certificat precis (cas du
        # certificat auto-signe du mock server, qui n'est dans aucune CA connue).
        self.ca_cert = ca_cert

        # Authentification (vraie API). Si auth_url est fourni, l'agent se
        # connecte pour obtenir un token JWT et l'ajoute a chaque envoi, avec
        # renouvellement automatique a l'expiration. Si auth_url est absent
        # (ex: mock server local sans auth), l'agent envoie sans token.
        self.auth_url = auth_url
        self.api_user = api_user
        self.api_password = api_password
        self.auth_active = bool(auth_url)
        self._token: str | None = None

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
        """Envoie un seul log par HTTP POST. Renvoie True si accepte (2xx).

        Si l'authentification est active, ajoute le token JWT. En cas de
        token expire ou invalide (401), se reconnecte une fois et reessaie.
        """
        try:
            if self.auth_active and self._token is None and not self._login():
                return False

            reponse = requests.post(
                self.server_url, json=log, timeout=self.timeout,
                verify=self.ca_cert, headers=self._auth_header(),
            )
            if reponse.status_code == 401 and self.auth_active:
                # Token expire (les JWT durent 30 min) : on rejoue le login.
                if not self._login():
                    return False
                reponse = requests.post(
                    self.server_url, json=log, timeout=self.timeout,
                    verify=self.ca_cert, headers=self._auth_header(),
                )
            return reponse.status_code in (200, 201)
        except requests.exceptions.RequestException:
            # Pas de connexion, timeout, DNS injoignable, etc.
            return False

    def _auth_header(self) -> dict:
        """En-tete Authorization si un token est disponible, sinon vide."""
        if self._token:
            return {"Authorization": f"Bearer {self._token}"}
        return {}

    def _login(self) -> bool:
        """Recupere un token JWT aupres de l'API. Renvoie True si reussi."""
        try:
            reponse = requests.post(
                self.auth_url,
                json={"email": self.api_user, "password": self.api_password},
                timeout=self.timeout, verify=self.ca_cert,
            )
        except requests.exceptions.RequestException:
            return False

        if reponse.status_code != 200:
            return False

        data = reponse.json()
        # Un compte de service ne doit pas avoir de MFA : une machine ne peut
        # pas saisir de code TOTP. On echoue de facon explicite et bruyante.
        if data.get("mfa_required"):
            raise RuntimeError(
                "Le compte agent a le MFA active : authentification impossible "
                "sans TOTP. Desactivez le MFA sur ce compte de service."
            )
        self._token = data.get("access_token")
        return self._token is not None

    def _mettre_en_file_attente(self, log: dict) -> None:
        with open(self.queue_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log) + "\n")

    def _reecrire_file_attente(self, lignes_restantes: list[str]) -> None:
        with open(self.queue_file, "w", encoding="utf-8") as f:
            for ligne in lignes_restantes:
                f.write(ligne + "\n")
