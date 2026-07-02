"""
Point d'entree de l'agent de collecte Windows.

Surveille le Journal d'evenements Windows (canal Security) et envoie les
evenements normalises a l'API centrale, en reutilisant les briques de l'agent
Linux : normalizer (contrat JSON), sender (HTTPS + JWT + file d'attente).

A lancer depuis un terminal ADMINISTRATEUR (le canal Security l'exige) :
    python agent_windows.py
    python agent_windows.py autre.yaml   # config differente (tests)
"""

import sys
import time

from config_windows import charger_config_windows
from normalizer import normaliser
from parsers.windows_parser import WindowsEventParser
from sender import Sender
from windows_source import WindowsEventSource


def main():
    chemin_config = sys.argv[1] if len(sys.argv) > 1 else "config.windows.yaml"
    config = charger_config_windows(chemin_config)

    sender = Sender(
        server_url=config.server_url,
        queue_file=config.queue_file,
        ca_cert=config.ca_cert if config.ca_cert else True,
        auth_url=config.auth_url,
        api_user=config.api_user,
        api_password=config.api_password,
    )

    parser = WindowsEventParser()
    source = WindowsEventSource(
        [{"channel": c.channel, "event_ids": c.event_ids} for c in config.watched_events]
    )

    resume = ", ".join(f"{c.channel}{c.event_ids}" for c in config.watched_events)
    print(f"[agent-win] Surveillance du Journal Windows : {resume}")
    print(f"[agent-win] Sondage toutes les {config.poll_interval}s (Ctrl+C pour arreter)")

    try:
        while True:
            for event in source.poll():
                resultat = parser.parse(event)
                if resultat is None:
                    continue  # EventID non suivi.

                log = normaliser(resultat, host=config.host, dest_ip=config.dest_ip)
                envoye = sender.envoyer(log)
                statut = "envoye" if envoye else "mis en file d'attente (reseau indisponible)"
                print(f"[agent-win] Log {statut} : {log['raw_message']}")

            sender.rejouer_file_attente()
            time.sleep(config.poll_interval)
    except KeyboardInterrupt:
        print("\n[agent-win] Arret demande, fermeture propre...")


if __name__ == "__main__":
    main()
