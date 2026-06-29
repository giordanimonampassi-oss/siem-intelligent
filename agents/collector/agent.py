"""
Point d'entree de l'agent de collecte.

Assemble les briques (config, parsers, watcher, normalizer, sender) et
lance la boucle principale qui :
  1. recoit les nouvelles lignes de log via le watcher
  2. les parse, les normalise, les envoie
  3. retente regulierement l'envoi des logs en attente (resilience reseau)
"""

import sys
import time

from config_loader import charger_config
from normalizer import normaliser
from parsers.apache_parser import ApacheParser
from parsers.auth_parser import AuthParser
from sender import Sender
from watcher import surveiller_fichiers


# Association entre le nom de parser indique dans config.yaml et la classe
# Python correspondante. Pour ajouter une nouvelle source (Cisco...),
# il suffit d'ajouter une ligne ici.
PARSEURS_DISPONIBLES = {
    "auth": AuthParser,
    "apache": ApacheParser,
}


def main():
    # Permet de tester avec un fichier de config different de celui par
    # defaut (utile pour les tests locaux sans toucher au config.yaml de prod).
    chemin_config = sys.argv[1] if len(sys.argv) > 1 else "config.yaml"
    config = charger_config(chemin_config)
    sender = Sender(
        server_url=config.server_url,
        queue_file=config.queue_file,
        ca_cert=config.ca_cert if config.ca_cert else True,
        auth_url=config.auth_url,
        api_user=config.api_user,
        api_password=config.api_password,
    )

    fichiers_et_callbacks = []
    for fichier_surveille in config.watched_files:
        classe_parser = PARSEURS_DISPONIBLES[fichier_surveille.parser]
        parser = classe_parser()

        callback = construire_callback(parser, sender, config)
        fichiers_et_callbacks.append((fichier_surveille.path, callback))

        print(f"[agent] Surveillance de {fichier_surveille.path} (parser: {fichier_surveille.parser})")

    observer = surveiller_fichiers(fichiers_et_callbacks)

    try:
        while True:
            time.sleep(config.retry_interval)
            sender.rejouer_file_attente()
    except KeyboardInterrupt:
        print("\n[agent] Arret demande, fermeture propre...")
        observer.stop()
        observer.join()


def construire_callback(parser, sender, config):
    """Cree la fonction appelee a chaque nouvelle ligne de log detectee."""

    def traiter_ligne(ligne: str):
        resultat = parser.parse(ligne)
        if resultat is None:
            return  # Ligne non reconnue par ce parser, on l'ignore.

        log = normaliser(resultat, host=config.host, dest_ip=config.dest_ip)

        envoye = sender.envoyer(log)
        statut = "envoye" if envoye else "mis en file d'attente (reseau indisponible)"
        print(f"[agent] Log {statut} : {log['raw_message']}")

    return traiter_ligne


if __name__ == "__main__":
    main()
