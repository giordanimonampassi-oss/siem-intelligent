# Pipeline — Agents de collecte (Smart SIEM)

Ce document décrit le pipeline complet de mise en place des agents de collecte, de la création des VM jusqu'à l'intégration avec le reste de l'équipe (Backend FastAPI + BDD).

## Phase 0 — Cadrage
- [x] Confirmer le contrat JSON avec le Dev Backend (FastAPI) :
  - `log_type` : `auth`, `web`, `network`, `system`
  - `severity` : `info`, `warning`, `high`, `critical`
  - `timestamp` : ISO 8601 UTC (`Z`)
  - champs manquants : `null` explicite (jamais de champ omis)

## Phase 1 — Environnement VM
- [ ] Installer VirtualBox + ISO Ubuntu Server 22.04 LTS
- [ ] Créer la VM `CTU-AUTH` (512 Mo RAM, 10 Go disque, 1 CPU)
- [ ] Configurer le réseau Host-Only (carte NAT + carte Host-Only, IP fixe via Netplan)
- [ ] Vérifier la connectivité (ping VM ↔ hôte)
- [ ] Cloner la VM (clone lié) pour créer `CTU-WEB`

## Phase 2 — Services générateurs de logs réels
- [ ] Installer/configurer OpenSSH sur `CTU-AUTH` → génère `/var/log/auth.log`
- [ ] Installer/configurer Apache2 sur `CTU-WEB` → génère `/var/log/apache2/access.log` + `error.log`
- [ ] Provoquer manuellement quelques événements (échecs SSH, requêtes HTTP) pour valider le format réel des logs

## Phase 3 — Agent de collecte (Python custom)
- [ ] Concevoir la structure du script :
  - `CONFIG` — IP du serveur, fichiers à surveiller, nom du host
  - `WATCHER` — surveille les fichiers de logs (watchdog / inotify)
  - `PARSER` — extrait les champs selon le type de log
  - `NORMALIZER` — assigne `log_type` et `severity` selon les règles de mapping
  - `SENDER` — construit le JSON et POST vers l'API
  - `MAIN` — boucle principale, gestion des erreurs et reconnexion
- [ ] Écrire le parser `auth.log` (priorité — scénario SC-01 brute force SSH)
- [ ] Écrire le parser Apache (`access.log` / `error.log`)
- [ ] Écrire le parser Cisco simulé (format IOS via Syslog)

## Phase 4 — Test local sans dépendre du backend réel
- [ ] Créer un mock server local (FastAPI, pour matcher la validation Pydantic réelle) avec endpoint `POST /api/v1/logs`
- [ ] Pointer l'agent (config externalisée — IP/port modifiable) vers ce mock en local
- [ ] Lancer le scénario SC-01 (6 échecs SSH) et vérifier que le JSON reçu est conforme au contrat

## Phase 5 — Déploiement agent sur les VM
- [ ] Copier l'agent sur `CTU-AUTH` et `CTU-WEB`, adapter la config (IP serveur, fichiers surveillés, hostname)
- [ ] Créer un service `systemd` pour démarrage automatique

## Phase 6 — Intégration équipe (différée, pas bloquante)
- [ ] Mettre en place le point de convergence (tunnel ngrok/Tailscale ou serveur partagé) quand Backend + BDD seront prêts à recevoir du trafic externe
- [ ] Reconfigurer l'agent pour pointer vers l'IP réelle (un seul paramètre à changer)
- [ ] Test d'intégration bout-en-bout (VM → agent → vraie API FastAPI → vraie BDD)

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
|---|---|
| `Failed password for root` | critical |
| `Failed password for [user]` | warning |
| `Invalid user` | warning |
| `Accepted password` / `Accepted key` | info |
| `POSSIBLE BREAK-IN ATTEMPT` | critical |
| `sudo: authentication failure` | high |
| `session opened for user root` | high |

### Règles de mapping `severity` — Apache access.log
| Code HTTP | Severity |
|---|---|
| 2xx | info |
| 3xx | info |
| 4xx | warning |
| 403 | high |
| 5xx | high |
