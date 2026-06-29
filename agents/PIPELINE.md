# Pipeline — Agents de collecte (Smart SIEM)

Ce document décrit le pipeline complet de mise en place des agents de collecte, de la création des VM jusqu'à l'intégration avec le reste de l'équipe (Backend FastAPI + BDD).

## Phase 0 — Cadrage

- [x] Confirmer le contrat JSON avec le Dev Backend (FastAPI) :
  - `log_type` : `auth`, `network`, `system`, `application`, `cloud` (les logs web Apache → `application`)
  - `severity` (logs) : `info`, `warning`, `critical` — `high` est un niveau d'**alerte** (`AlertSeverity`), pas de log
  - `timestamp` : ISO 8601 UTC (`Z`)
  - champs manquants : `null` explicite (jamais de champ omis)

## Phase 1 — Environnement VM

- [x] Installer VirtualBox + ISO Ubuntu Live Server 24.04.4 LTS
- [x] Créer la VM `CTU-AUTH` (2 Go RAM, 10 Go disque, 2 CPU — ajusté depuis 512 Mo/1 CPU, freeze de l'installeur Subiquity sous-dimensionné)
- [x] Configurer le réseau Host-Only (NIC1 NAT + NIC2 Host-Only sur `VirtualBox Host-Only Ethernet Adapter`, IP fixe `192.168.6.10/24` via Netplan)
- [x] Vérifier la connectivité (ping VM ↔ hôte `192.168.6.1` — OK)
- [x] Cloner la VM (clone lié, via snapshot `base`) pour créer `CTU-WEB` — IP `192.168.6.11/24`, hostname `ctu-web`

## Phase 2 — Services générateurs de logs réels

- [x] Installer/configurer OpenSSH sur `CTU-AUTH` → génère `/var/log/auth.log` (service activé via `systemctl enable --now ssh`)
- [x] Installer/configurer Apache2 sur `CTU-WEB` → génère `/var/log/apache2/access.log` + `error.log` (confirmé : `GET / HTTP/1.1 200`)
- [x] Provoquer manuellement quelques événements : échecs SSH répétés → `Invalid user` / `Failed password` confirmés dans `auth.log` ; requêtes HTTP → `200` et `404` confirmés dans `access.log`

## Phase 3 — Agent de collecte (Python custom)

- [x] Concevoir la structure du script (`agents/collector/`) :
  - `config.yaml` / `config_loader.py` — IP du serveur, fichiers à surveiller, host, dest_ip
  - `watcher.py` — surveille les fichiers de logs (watchdog)
  - `parsers/` — `base.py` (interface commune) + un parser par source
  - `normalizer.py` — assigne `log_type` et `severity` selon les règles de mapping
  - `sender.py` — construit le JSON, POST vers l'API, file d'attente locale si échec réseau
  - `agent.py` — point d'entrée, boucle principale
- [x] Écrire le parser `auth.log` (priorité — scénario SC-01 brute force SSH) — testé en local sur 4 cas réels (Invalid user, Failed password root/non-root, Accepted password), severity correcte dans tous les cas
- [x] Extraction de `source_ip` pour les lignes PAM (`rhost=`) et `Connection reset by ...` qui n'étaient pas couvertes initialement
- [x] Distinction des lignes `cron` (activité système routinière) du reste de `auth.log` : classées en `log_type: "system"`, `severity: "info"`, pour éviter les fausses alertes
- [x] Écrire le parser Apache (`access.log`, format `combined`) — testé sur 3 lignes réelles de `CTU-WEB` (200, 404 x2), severity correcte
- [ ] Écrire le parser Apache `error.log`
- [ ] Écrire le parser Cisco simulé (format IOS via Syslog)

## Phase 4 — Test local sans dépendre du backend réel

- [x] Créer un mock server local (FastAPI) avec endpoint `POST /api/v1/logs` (`agents/collector/mock_server.py`)
- [x] Pointer l'agent (config externalisée via `config.yaml`, surchargeable en argument CLI) vers ce mock en local
- [x] Test de bout en bout : `Invalid user`, `Failed password` (root/non-root), `Accepted password` → JSON reçu conforme au contrat, severity correcte
- [x] Test de résilience réseau : serveur coupé → log mis en file d'attente locale, sans perte ; serveur relancé → log rejoué automatiquement au prochain cycle (`retry_interval`)
- [x] Chiffrement en transit (TLS) — exigence section 4.2 du cahier des charges : `server_url` en `https://`, certificat auto-signé pour le mock server (`certs/generate_cert.sh`), vérifié côté agent via `ca_cert` dans `config.yaml` (`requests.post(..., verify=ca_cert)`). Testé bout-en-bout : log envoyé et reçu correctement, et confirmé qu'une requête sans le certificat est bien rejetée (`SSLError`)

## Phase 5 — Déploiement agent sur les VM

- [x] Copier l'agent sur `CTU-AUTH` (scp), adapter la config (`server_url` vers l'hôte, `queue_file` en répertoire utilisateur)
- [x] Validation réelle bout-en-bout sur `CTU-AUTH` : tentative SSH échouée → ligne `auth.log` réelle → agent → mock server sur l'hôte, JSON conforme au contrat reçu dans `mock_received_logs.jsonl`
- [x] Copier l'agent sur `CTU-WEB` (scp), adapter la config (`host`, `dest_ip`, parser `apache`)
- [x] Validation réelle bout-en-bout sur `CTU-WEB` : requêtes HTTP (200, 404 x2) → agent → mock server, JSON conforme au contrat
- [x] Chiffrement TLS déployé et validé bout-en-bout sur les **deux VM** : `server_url` en `https://`, certificat auto-signé du mock copié sur chaque VM (`certs/mock_server.crt`) et vérifié via `ca_cert` — log réel envoyé et reçu en HTTPS sur `CTU-AUTH` (auth.log) et `CTU-WEB` (access.log)
- [ ] Créer un service `systemd` pour démarrage automatique (sur les deux VM)

## Phase 6 — Intégration équipe (réalisée)

- [x] Point de convergence : **Tailscale**. L'API (PC du dev backend, nœud `gaps`) est exposée en HTTPS via `tailscale serve` → `https://gaps.taildaa032.ts.net` (certificat Let's Encrypt réel, accessible uniquement depuis le tailnet ; uvicorn bind sur `127.0.0.1`). Les deux VM ont rejoint le tailnet.
- [x] Agent reconfiguré : `server_url`/`auth_url` vers la vraie API **avec authentification JWT** (`POST /api/v1/auth/login` → `Authorization: Bearer`, renouvellement automatique sur 401). Identifiants dans un `.env` gitignoré (`SIEM_AGENT_PASSWORD`), pas dans `config.yaml`.
- [x] Compte de service dédié créé côté Backend (`agent@ctu.gov`, rôle `reader`, **MFA désactivé** — une machine ne peut pas saisir de TOTP)
- [x] `ca_cert` retiré : certificat Let's Encrypt reconnu → vérification standard
- [x] Alignement du contrat : `severity` ramenée à 3 niveaux (`high` → `warning`, car `high` est un niveau d'alerte), `log_type` web → `application`, pour coller aux enums du Backend
- [x] Test d'intégration bout-en-bout validé : `CTU-AUTH` (auth.log) et `CTU-WEB` (access.log) → agent → vraie API FastAPI → PostgreSQL + Elasticsearch (`201`, `es_indexed: true`)

## Phase 7 — Documentation

- [ ] Rédiger le README technique (reproduction de l'environnement depuis zéro) dans `agents/`

## Contrat JSON (référence)

```json
{
  "timestamp": "2026-03-14T06:14:37Z",
  "source_ip": "178.43.12.87",
  "dest_ip": "10.0.1.22",
  "host": "ctu-srv-01",
  "username": "root",
  "log_type": "auth",
  "severity": "critical",
  "raw_message": "Failed password for root from 178.43.12.87 port 53241 ssh2",
  "batch_id": null
}
```

### Règles de mapping `severity` — auth.log

| Motif dans le log | Severity |
| --- | --- |
| `Failed password for root` | critical |
| `Failed password for [user]` | warning |
| `Invalid user` | warning |
| `Accepted password` / `Accepted key` | info |
| `POSSIBLE BREAK-IN ATTEMPT` | critical |
| `authentication failure` | warning |
| `session opened for user root` | warning |

### Règles de mapping `severity` — Apache access.log (`log_type: application`)

| Code HTTP | Severity |
| --- | --- |
| 2xx | info |
| 3xx | info |
| 4xx (dont 403) | warning |
| 5xx | warning |
