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
| `parsers/apache_parser.py` | Parse `/var/log/apache2/access.log` (format `combined`). |
| `normalizer.py` | Calcule la `severity` et construit le JSON final conforme au contrat. |
| `sender.py` | Envoie le JSON par `POST` (HTTPS). En cas d'échec, écrit dans `queue_file` et réessaie automatiquement. |
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

# Generer le certificat TLS auto-signe (une fois, ou si l'IP du reseau Host-Only change)
./certs/generate_cert.sh 192.168.6.1

# Lancer le mock server en HTTPS
uvicorn mock_server:app --host 0.0.0.0 --port 8000 \
    --ssl-keyfile certs/mock_server.key --ssl-certfile certs/mock_server.crt
```

Les logs reçus s'affichent dans la console et sont sauvegardés dans `mock_received_logs.jsonl` (ignoré par git).

## Chiffrement en transit (TLS)

Le cahier des charges exige le chiffrement des communications (section 4.2). `server_url` dans `config.yaml` est en `https://`. Comme le mock server utilise un certificat auto-signé (pas émis par une CA reconnue), l'agent doit explicitement lui faire confiance via le champ `ca_cert` :

```yaml
server_url: "https://192.168.6.1:8000/api/v1/logs"
ca_cert: "certs/mock_server.crt"
```

`sender.py` passe ce chemin à `requests.post(..., verify=ca_cert)`. Sans `ca_cert` (champ absent), la vérification standard s'applique — c'est le cas attendu une fois branché sur la vraie API si elle a un certificat émis par une CA reconnue (ex. Let's Encrypt). Si la vraie API utilise elle aussi un certificat auto-signé/interne, il suffira de pointer `ca_cert` vers ce certificat, même principe.

Le certificat et la clé (`certs/*.crt`, `certs/*.key`) ne sont pas commités (gitignorés) : chaque dev les régénère avec `certs/generate_cert.sh`, car ils doivent couvrir l'IP réelle du réseau Host-Only de sa machine.

## Limitations connues

- `watchdog==4.0.1` n'est pas compatible avec Python 3.13 (bug interne lié à `threading`) : le projet utilise `watchdog==6.0.0`.
- Le parser `auth.log` gère deux formats de timestamp : l'ISO 8601 complet (défaut Ubuntu 22.04+, avec année et fuseau horaire) et l'ancien format syslog classique sans année (où l'année courante est supposée, et l'horloge de la VM supposée en UTC).
- Sur Ubuntu 24.04, `pip install` refuse d'installer dans l'environnement système (PEP 668). Solution utilisée : `pip install --user --break-system-packages -r requirements.txt`, qui installe dans `~/.local` sans toucher aux paquets système.
- Une VM clonée garde le compte Linux de la VM d'origine : sur `CTU-WEB` (clonée depuis `CTU-AUTH`), le compte de connexion reste `ctu-auth` même si la VM et son hostname s'appellent `ctu-web`.
