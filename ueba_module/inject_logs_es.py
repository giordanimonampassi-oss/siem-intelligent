"""
inject_logs_es.py

Injecte les logs générés par simulateur_logs.py DIRECTEMENT dans
Elasticsearch, sans passer par le backend. Utile pour tester la pipeline
IA en isolation quand le backend n'est pas encore connecté.

Usage :
  python inject_logs_es.py                          # injecte sample_logs.json
  python inject_logs_es.py --file mon_fichier.json  # fichier personnalisé
  python inject_logs_es.py --generate               # génère + injecte à la volée
  python inject_logs_es.py --n 50                   # génère 50 logs et injecte
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import requests
import urllib3

from config import ES_CONFIG
from utils.logger import get_logger

urllib3.disable_warnings()
logger = get_logger("inject_es")

ES    = ES_CONFIG.host
AUTH  = (ES_CONFIG.user, ES_CONFIG.password)
VERIFY = ES_CONFIG.verify_certs
INDEX = ES_CONFIG.index


def inject_from_file(filepath: str) -> dict:
    path = Path(filepath)
    if not path.exists():
        logger.error("Fichier introuvable : %s", filepath)
        logger.info("Lance d'abord : python simulateur_logs.py --mode generate")
        return {"ok": 0, "errors": 0}

    with open(path, encoding="utf-8") as f:
        logs = json.load(f)

    logger.info("Injection de %d logs depuis %s vers %s/%s ...", len(logs), filepath, ES, INDEX)
    return _inject(logs)


def inject_generated(n: int = 100, anomaly_rate: float = 0.2) -> dict:
    from simulateur_logs import generate_dataset
    logs = generate_dataset(n_total=n, anomaly_ratio=anomaly_rate)
    logger.info("Injection de %d logs générés à la volée ...", len(logs))
    return _inject(logs)


def _inject(logs: list[dict]) -> dict:
    ok = err = 0
    for log in logs:
        doc_id = log.get("id", "")
        url    = f"{ES}/{INDEX}/_doc/{doc_id}?pipeline=siem-enrichment-pipeline"
        try:
            r = requests.put(url, json=log, auth=AUTH, verify=VERIFY, timeout=5)
            if r.status_code in (200, 201):
                ok += 1
            else:
                err += 1
                logger.warning("Erreur doc %s : %d — %s", doc_id[:8], r.status_code, r.text[:80])
        except Exception as e:
            err += 1
            logger.error("Exception doc %s : %s", doc_id[:8], e)

    logger.info("Injection terminée : %d OK / %d erreurs", ok, err)

    # Vérification du count dans ES
    r = requests.get(f"{ES}/{INDEX}/_count", auth=AUTH, verify=VERIFY)
    if r.status_code == 200:
        total = r.json().get("count", "?")
        logger.info("Total documents dans %s : %s", INDEX, total)

    return {"ok": ok, "errors": err}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Injection de logs dans Elasticsearch")
    parser.add_argument("--file",     type=str, default="sample_logs.json",
                        help="Fichier JSON à injecter (défaut: sample_logs.json)")
    parser.add_argument("--generate", action="store_true",
                        help="Génère les logs à la volée avant d'injecter")
    parser.add_argument("--n",        type=int, default=100,
                        help="Nombre de logs à générer (avec --generate)")
    args = parser.parse_args()

    if args.generate:
        result = inject_generated(n=args.n)
    else:
        result = inject_from_file(args.file)

    print(f"\nRésultat : {result['ok']} injectés / {result['errors']} erreurs")
