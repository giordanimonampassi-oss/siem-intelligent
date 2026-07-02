"""
setup_es_pipeline.py

Remplace setup_es_pipeline.sh pour Windows.
Crée dans Elasticsearch :
  1. Le template d'index siem-logs (mapping + pipeline par défaut)
  2. L'ingest pipeline siem-enrichment-pipeline (enrichissement + règles IA)
  3. L'index logs-analyzed pour les résultats enrichis

Usage :
  python setup_es_pipeline.py              # setup complet
  python setup_es_pipeline.py --check      # vérifie que tout est en place
  python setup_es_pipeline.py --delete     # supprime et recrée (reset propre)
"""
from __future__ import annotations

import argparse
import sys

import requests
import urllib3

from config import ES_CONFIG
from utils.logger import get_logger

urllib3.disable_warnings()
logger = get_logger("setup_es")

ES   = ES_CONFIG.host
AUTH = (ES_CONFIG.user, ES_CONFIG.password)
VERIFY = ES_CONFIG.verify_certs


def _put(path: str, body: dict, label: str) -> bool:
    r = requests.put(f"{ES}{path}", json=body, auth=AUTH, verify=VERIFY)
    if r.status_code in (200, 201):
        logger.info("✓ %s : OK", label)
        return True
    else:
        logger.error("✗ %s : %d — %s", label, r.status_code, r.text[:200])
        return False


def _delete(path: str, label: str) -> None:
    r = requests.delete(f"{ES}{path}", auth=AUTH, verify=VERIFY)
    logger.info("DELETE %s : %d", label, r.status_code)


def check_es_connection() -> bool:
    try:
        r = requests.get(ES, auth=AUTH, verify=VERIFY, timeout=5)
        info = r.json()
        logger.info(
            "Connexion ES OK — version %s, cluster=%s, status=%s",
            info["version"]["number"],
            info["cluster_name"],
            r.status_code,
        )
        return True
    except Exception as e:
        logger.error("Connexion ES échouée : %s", e)
        return False


def create_index_template() -> bool:
    body = {
        "index_patterns": ["siem-logs*"],
        "template": {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "default_pipeline": "siem-enrichment-pipeline",
            },
            "mappings": {
                "properties": {
                    "id":            {"type": "keyword"},
                    "timestamp":     {"type": "date"},
                    "created_at":    {"type": "date"},
                    "source_ip":     {"type": "keyword"},
                    "dest_ip":       {"type": "keyword"},
                    "host":          {"type": "keyword"},
                    "username":      {"type": "keyword"},
                    "log_type":      {"type": "keyword"},
                    "severity":      {"type": "keyword"},
                    "severity_score":{"type": "integer"},
                    "raw_message":   {"type": "text"},
                    "is_suspicious": {"type": "boolean"},
                    "note":          {"type": "text"},
                    "batch_id":      {"type": "keyword"},
                    "es_indexed":    {"type": "boolean"},
                    "node_id":       {"type": "keyword"},
                    "ai_alert": {
                        "properties": {
                            "level":  {"type": "keyword"},
                            "reason": {"type": "text"},
                            "score":  {"type": "float"},
                        }
                    },
                }
            },
        },
    }
    return _put("/_index_template/siem-logs-template", body, "Index template siem-logs")


def create_ingest_pipeline() -> bool:
    # Script Painless séparé pour la lisibilité
    painless_script = """
        Map sev = ["info": 0, "warning": 1, "error": 2, "critical": 3];
        String s = ctx.containsKey("severity") ? ctx.severity.toLowerCase() : "info";
        ctx.severity_score = sev.getOrDefault(s, 0);

        String level = "low";
        String reason = "";

        // Règle 1 : flag agent
        if (ctx.containsKey("is_suspicious") && ctx.is_suspicious == true) {
            level = "high";
            reason += "Agent flag is_suspicious=true. ";
        }

        // Règle 2 : sévérité critique
        if (ctx.severity_score >= 3) {
            level = "critical";
            reason += "Severity critique. ";
        }

        // Règle 3 : chemins/outils suspects dans raw_message
        String raw = ctx.containsKey("raw_message") ? ctx.raw_message.toLowerCase() : "";
        String[] suspects = new String[]{
            "/admin", "/backup", "/.env", "/config",
            "passwd", "phpmyadmin", "wp-admin",
            "sqlmap", "nikto", "masscan", "nmap"
        };
        for (String p : suspects) {
            if (raw.contains(p)) {
                if (level.equals("low")) level = "medium";
                reason += "Suspicious pattern: " + p + ". ";
                break;
            }
        }

        // Règle 4 : auth failure
        if (ctx.containsKey("log_type") && ctx.log_type.equals("auth") && ctx.severity_score >= 2) {
            if (level.equals("low")) level = "medium";
            reason += "Auth failure event. ";
        }

        // Règle 5 : IP externe sur auth
        if (ctx.containsKey("log_type") && ctx.log_type.equals("auth")) {
            String sip = ctx.containsKey("source_ip") ? ctx.source_ip : "";
            boolean isInternal = sip.startsWith("192.168") || sip.startsWith("10.")
                              || sip.startsWith("127") || sip.equals("::1");
            if (!isInternal && !sip.isEmpty()) {
                if (level.equals("low")) level = "medium";
                reason += "External IP auth: " + sip + ". ";
            }
        }

        ctx.ai_alert = [
            "level":  level,
            "reason": reason.isEmpty() ? "No anomaly detected" : reason.trim(),
            "score":  ctx.severity_score
        ];
    """

    body = {
        "description": "SIEM CTU — enrichissement et détection par règles (précède Isolation Forest)",
        "processors": [
            # 1. Marque le document comme indexé
            {"set": {"field": "es_indexed", "value": True}},
            # 2. Applique les règles de détection
            {"script": {"lang": "painless", "source": painless_script}},
            # 3. Supprime les champs internes inutiles pour ES
            {"remove": {"field": ["node_id"], "ignore_missing": True}},
        ],
        "on_failure": [
            {"set": {"field": "pipeline_error", "value": "{{_ingest.on_failure_message}}"}}
        ],
    }
    return _put("/_ingest/pipeline/siem-enrichment-pipeline", body, "Ingest pipeline siem-enrichment-pipeline")


def create_analyzed_index() -> bool:
    body = {
        "settings": {"number_of_shards": 1, "number_of_replicas": 0},
        "mappings": {
            "properties": {
                "original_id":      {"type": "keyword"},
                "timestamp":        {"type": "date"},
                "host":             {"type": "keyword"},
                "username":         {"type": "keyword"},
                "if_anomaly_score": {"type": "float"},
                "is_anomaly":       {"type": "boolean"},
                "ai_alert": {
                    "properties": {
                        "level":  {"type": "keyword"},
                        "reason": {"type": "text"},
                        "score":  {"type": "float"},
                    }
                },
            }
        },
    }
    r = requests.get(f"{ES}/logs-analyzed", auth=AUTH, verify=VERIFY)
    if r.status_code == 200:
        logger.info("✓ Index logs-analyzed : déjà existant (skip)")
        return True
    return _put("/logs-analyzed", body, "Index logs-analyzed")


def check_setup() -> None:
    """Vérifie que les ressources ES sont bien en place."""
    logger.info("=== Vérification du setup ES ===")
    resources = {
        "Pipeline":       f"/_ingest/pipeline/siem-enrichment-pipeline",
        "Index template": f"/_index_template/siem-logs-template",
        "Index analyzed": f"/logs-analyzed",
        "Index siem-logs (si existant)": f"/siem-logs",
    }
    for label, path in resources.items():
        r = requests.get(f"{ES}{path}", auth=AUTH, verify=VERIFY)
        status = "✓ OK" if r.status_code == 200 else f"✗ Absent ({r.status_code})"
        logger.info("  %-35s : %s", label, status)

    # Compte les docs dans siem-logs
    r = requests.get(f"{ES}/siem-logs/_count", auth=AUTH, verify=VERIFY)
    if r.status_code == 200:
        logger.info("  %-35s : %d documents", "Logs indexés (siem-logs)", r.json().get("count", 0))


def delete_all() -> None:
    """Supprime proprement les ressources pour repartir de zéro."""
    logger.warning("Suppression des ressources ES...")
    _delete("/_ingest/pipeline/siem-enrichment-pipeline", "pipeline")
    _delete("/_index_template/siem-logs-template", "template")
    _delete("/logs-analyzed", "index logs-analyzed")
    _delete("/siem-logs", "index siem-logs")
    logger.info("Suppression terminée. Lance sans --delete pour recréer.")


def setup_all() -> None:
    logger.info("=== Setup Elasticsearch SIEM CTU ===")

    if not check_es_connection():
        logger.error("Impossible de joindre ES sur %s — arrêt.", ES)
        sys.exit(1)

    results = [
        create_index_template(),
        create_ingest_pipeline(),
        create_analyzed_index(),
    ]

    if all(results):
        logger.info("=== ✅ Setup terminé avec succès ===")
        logger.info("Test rapide : python setup_es_pipeline.py --check")
    else:
        logger.error("=== ⚠️  Certaines ressources n'ont pas pu être créées — voir logs ci-dessus ===")
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Setup Elasticsearch pour SIEM CTU")
    parser.add_argument("--check",  action="store_true", help="Vérifie que tout est en place")
    parser.add_argument("--delete", action="store_true", help="Supprime et recrée (reset)")
    args = parser.parse_args()

    if args.delete:
        delete_all()
    elif args.check:
        check_setup()
    else:
        setup_all()
