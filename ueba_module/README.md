# CTU-SIEM UEBA Module — Guide opérationnel

## Procédure d'installation et test (5 minutes)

### Prérequis
- Python 3.9+
- Docker + Docker Compose (pour ES + Postgres)
- BENIGN.csv dans `data/1_baseline/`

---

### Étape 1 — Configuration (30 sec)

```bash
cp .env.example .env
# Édite .env si nécessaire (ES_PASSWORD, PG_PASSWORD, BACKEND_URL)
```

---

### Étape 2 — Dépendances Python (1 min)

```bash
pip install -r requirements.txt
```

---

### Étape 3 — Setup Elasticsearch (1 min)

```bash
chmod +x setup_es_pipeline.sh
./setup_es_pipeline.sh

# Vérification :
curl -ku elastic:changeme https://localhost:9200/_ingest/pipeline/siem-enrichment-pipeline | python -m json.tool | head -20
```

---

### Étape 4 — Entraînement du modèle (1-2 min selon taille BENIGN.csv)

```bash
# Entraînement simple
python main.py train

# Avec évaluation sur fichiers d'attaques (recommandé pour la soutenance)
python main.py train \
  --csv data/1_baseline/BENIGN.csv \
  --contamination 0.05 \
  --estimators 200 \
  --attacks data/PortScan.csv data/DDoS.csv data/SSH-Patator.csv
```

Résultat attendu dans `saved_models/` :
```
saved_models/
├── isolation_forest.pkl
├── scaler_standard.pkl
└── feature_names.json
```

---

### Étape 5 — Tests (30 sec)

```bash
# Option A : Générer le jeu de données de test (sans envoi)
python simulateur_logs.py --mode generate --output sample_logs.json

# Option B : Envoyer 100 logs vers le backend (backend doit être up)
python simulateur_logs.py --mode batch --n 100

# Option C : Flux continu (Ctrl+C pour arrêter)
python simulateur_logs.py --mode continuous

# Détection sur les logs ES en base
python main.py detect
```

---

## Variables d'environnement configurables

| Variable | Défaut | Description |
|---|---|---|
| `BACKEND_URL` | `http://localhost:8080` | URL du backend FastAPI |
| `LOG_RATE` | `1` | Logs/seconde (mode continuous) |
| `LOG_TYPES` | `application,system,auth,network` | Types à générer |
| `ANOMALY_RATE` | `0.2` | Probabilité d'anomalie (0.0–1.0) |
| `ES_HOST` | `https://localhost:9200` | URL Elasticsearch |
| `EXTRACTION_WINDOW_MINUTES` | `15` | Fenêtre d'extraction ES |
| `ISOLATION_FOREST_CONTAMINATION` | `0.05` | Taux de contamination IF |

---

## Lancement de l'API de scoring

```bash
# Mode développement
uvicorn api.app:app --host 0.0.0.0 --port 8000 --reload

# Test healthcheck
curl http://localhost:8000/health

# Score un log unique
curl -X POST http://localhost:8000/score \
     -H "Content-Type: application/json" \
     -d '{
       "log_type": "auth",
       "severity": "error",
       "source_ip": "203.0.113.45",
       "is_suspicious": true,
       "raw_message": "Failed password for root from 203.0.113.45"
     }'

# Consulter les alertes générées
curl http://localhost:8000/alerts
curl "http://localhost:8000/alerts?level=critical"
```

---

## Vérification des logs dans Elasticsearch

```bash
# Compter les logs indexés
curl -ku elastic:changeme https://localhost:9200/siem-logs/_count | python -m json.tool

# Voir les 5 derniers logs avec champ ai_alert
curl -ku elastic:changeme https://localhost:9200/siem-logs/_search?pretty \
  -H "Content-Type: application/json" \
  -d '{
    "size": 5,
    "sort": [{"@timestamp": "desc"}],
    "_source": ["timestamp", "severity", "log_type", "ai_alert", "is_suspicious"],
    "query": {"match_all": {}}
  }'

# Filtrer uniquement les alertes high/critical
curl -ku elastic:changeme https://localhost:9200/siem-logs/_search?pretty \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "terms": { "ai_alert.level": ["high", "critical"] }
    }
  }'
```

---

## Architecture des flux

```
BENIGN.csv ──────────────────────────────────────────────────────────┐
                                                                       ▼
simulateur_logs.py ──→ POST /api/v1/logs ──→ backend ──→ ES(siem-logs)
                                                              │
                                              pipeline siem-enrichment-pipeline
                                                              │
                                              HTTP POST → api/app.py :8000/score
                                                              │
                                              ai_alert {level, reason, score}
                                                              │
                                                    logs-analyzed index
                                                              │
                                              main.py detect (Isolation Forest)
                                                              │
                                              data/3_anomalies/*.csv
                                                              │
                                              Dashboard React (alertes)
```

---

## Comparaison : logs normaux vs anormaux

| Pattern | log_type | severity | is_suspicious | Détecté par |
|---|---|---|---|---|
| GET /api/v1/logs 200 | application | info | false | — (normal) |
| SSH login OK | auth | info | false | — (normal) |
| Service started | system | info | false | — (normal) |
| **Bruteforce SSH** | auth | error | **true** | Agent + règles + IF |
| **Accès /admin 3h** | application | warning | false | Règles (off-hours) + IF |
| **sqlmap scan** | application | warning | **true** | Agent + règles (UA) |
| **sudo root** non autorisé | auth | critical | **true** | Agent + règles + IF |
| **Port scan** 20+ ports | network | warning | **true** | Agent + IF (volume) |

---

## Mode Docker (production)

```bash
# Stack complet
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d

# Logs du simulateur
docker logs ueba-simulator

# Logs de l'API de scoring
docker logs ueba-api -f
```
