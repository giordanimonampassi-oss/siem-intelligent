# Agents de collecte — Smart SIEM

Ce dossier contient l'agent de collecte de logs (WBS 1.1.2) et l'infrastructure de test associée. Le détail complet du pipeline (VM, services, agent, intégration) est dans [PIPELINE.md](PIPELINE.md).

## Ce qui est fait

- Deux VM Ubuntu 24.04 (`CTU-AUTH` avec OpenSSH, `CTU-WEB` avec Apache2) générant de vrais logs sur un réseau Host-Only VirtualBox.
- Un agent Python custom (`collector/`) qui surveille des fichiers de logs en continu, parse les lignes, les normalise selon le contrat JSON convenu avec le Backend, et les envoie par HTTP.
- Une file d'attente locale automatique si l'envoi échoue (coupure réseau) — testée et validée : aucun log n'est perdu, tout est rejoué dès que la connexion revient.
- Un serveur mock (`collector/mock_server.py`) qui remplace temporairement la vraie API FastAPI du Backend, pour pouvoir valider l'agent sans dépendre de son avancement.

## Architecture du code (`collector/`)

| Fichier | Rôle |
| --- | --- |
| `config.yaml` | **Seul fichier à modifier pour déployer ou changer de cible.** Contient l'URL du serveur (`server_url`), l'identité de la machine (`host`, `dest_ip`) et la liste des fichiers surveillés. |
| `config_loader.py` | Charge et valide `config.yaml`. |
| `parsers/base.py` | Interface commune à tous les parsers (`LogParse`). |
| `parsers/auth_parser.py` | Parse `/var/log/auth.log` (SSH : `Failed password`, `Invalid user`, `Accepted password`...). |
| `normalizer.py` | Calcule la `severity` et construit le JSON final conforme au contrat. |
| `sender.py` | Envoie le JSON par `POST`. En cas d'échec, écrit dans `queue_file` et réessaie automatiquement. |
| `watcher.py` | Surveille les fichiers en continu (équivalent `tail -f`, basé sur `watchdog`). |
| `agent.py` | Point d'entrée. Assemble tout et lance la boucle principale. |
| `mock_server.py` | Récepteur FastAPI minimal pour tester l'agent sans la vraie API. |

## Brancher la vraie API quand elle sera prête

Aucune modification de code n'est nécessaire. Il suffit de changer `server_url` dans `config.yaml` pour qu'il pointe vers l'API FastAPI réelle du Backend (directement, ou via un tunnel ngrok/Tailscale en attendant un serveur partagé — voir Phase 6 de `PIPELINE.md`).

## Lancer l'agent

```bash
cd agents/collector
pip install -r requirements.txt
python agent.py            # utilise config.yaml par defaut
python agent.py autre.yaml # ou un fichier de config different (utile pour les tests)
```

## Tester sans la vraie API (mock server)

```bash
cd agents/collector
pip install fastapi uvicorn
uvicorn mock_server:app --host 0.0.0.0 --port 8000
```

Les logs reçus s'affichent dans la console et sont sauvegardés dans `mock_received_logs.jsonl` (ignoré par git).

## Limitations connues

- Le timestamp de `auth.log` ne contient pas l'année (format syslog classique) : l'agent suppose l'année courante. Hypothèse acceptable pour ce projet académique tant que l'horloge de la VM est correcte.
- `watchdog==4.0.1` n'est pas compatible avec Python 3.13 (bug interne lié à `threading`) : le projet utilise `watchdog==6.0.0`.
