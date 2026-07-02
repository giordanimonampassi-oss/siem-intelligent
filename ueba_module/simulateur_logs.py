"""
simulateur_logs.py

Remplace l'agent réel pour les tests IA en isolation.
Génère des logs respectant EXACTEMENT la structure payload de l'agent,
incluant des patterns normaux et anormaux (bruteforce, accès hors heures,
élévation de privilèges, requêtes suspectes).

Usage :
  python simulateur_logs.py --mode batch     # envoie 100 logs d'un coup
  python simulateur_logs.py --mode continuous # flux continu (LOG_RATE logs/sec)
  python simulateur_logs.py --mode generate  # génère sample_logs.json sans envoi

Variables d'environnement (.env ou export) :
  BACKEND_URL   (défaut: http://localhost:8080)
  LOG_RATE      (défaut: 1 log/seconde)
  LOG_TYPES     (défaut: application,system,auth,network)
  ANOMALY_RATE  (défaut: 0.2)
"""
from __future__ import annotations

import json
import logging
import os
import random
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

# ── Configuration ────────────────────────────────────────────────────────────
BACKEND_URL   = os.getenv("BACKEND_URL",  "http://localhost:8080")
LOG_RATE      = float(os.getenv("LOG_RATE",  "1"))
LOG_TYPES_ENV = os.getenv("LOG_TYPES", "application,system,auth,network")
ANOMALY_RATE  = float(os.getenv("ANOMALY_RATE", "0.2"))
LOG_TYPES     = [t.strip() for t in LOG_TYPES_ENV.split(",")]

# ── Logger interne du simulateur ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | SIMULATEUR | %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("simulateur.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("simulateur")

# ── Données réalistes de référence ───────────────────────────────────────────
HOSTS = ["ctu-web", "ctu-api", "ctu-db", "ctu-auth", "ctu-backup"]
INTERNAL_IPS = [
    "192.168.6.10", "192.168.6.11", "192.168.6.12",
    "192.168.1.100", "10.0.0.5",
]
EXTERNAL_IPS = [
    "203.0.113.45", "185.220.101.32", "91.108.4.1",
    "198.51.100.77", "45.33.32.156",
]
USERS_NORMAL = ["jack.bauer", "chloe.obrian", "tony.almeida", "david.palmer"]
USERS_SUSPICIOUS = ["root", "admin", "test", "guest", "unknown"]
HTTP_PATHS_NORMAL = [
    "/api/v1/logs", "/api/v1/alerts", "/api/v1/users",
    "/api/v1/dashboard", "/health", "/metrics",
]
HTTP_PATHS_SUSPICIOUS = [
    "/admin", "/admin/database", "/config", "/backup",
    "/.env", "/wp-admin", "/phpmyadmin", "/../../../etc/passwd",
]
USER_AGENTS_NORMAL = [
    "Mozilla/5.0 (X11; Linux x86_64)",
    "Python/requests 2.31.0",
    "CTU-Agent/1.0",
]
USER_AGENTS_SUSPICIOUS = [
    "curl/8.5.0", "sqlmap/1.7", "Nikto/2.1.6",
    "masscan/1.3", "python-httpx/0.24.0",
]
SSH_USERS = ["root", "ubuntu", "ec2-user", "admin", "loic"]
SERVICES = ["nginx", "postgresql", "elasticsearch", "sshd", "docker", "cron"]


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _random_past(max_hours: int = 24) -> datetime:
    return _now_utc() - timedelta(seconds=random.randint(0, max_hours * 3600))


def _off_hours_timestamp() -> datetime:
    """Génère un timestamp entre 1h et 5h du matin (hors heures de bureau)."""
    base = _now_utc().replace(hour=random.randint(1, 5),
                               minute=random.randint(0, 59),
                               second=random.randint(0, 59))
    return base


def _fmt_ts(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S+00:00")


# ── Générateurs de logs normaux ───────────────────────────────────────────────

def gen_application_normal() -> dict:
    method  = random.choice(["GET", "POST", "PUT", "DELETE"])
    path    = random.choice(HTTP_PATHS_NORMAL)
    code    = random.choice([200, 200, 200, 201, 301, 304])
    size    = random.randint(200, 5000)
    ua      = random.choice(USER_AGENTS_NORMAL)
    src_ip  = random.choice(INTERNAL_IPS)
    dest_ip = random.choice(INTERNAL_IPS)
    ts      = _random_past(8)
    return {
        "id": str(uuid.uuid4()),
        "timestamp": _fmt_ts(ts),
        "source_ip": src_ip,
        "dest_ip": dest_ip,
        "host": random.choice(HOSTS),
        "username": random.choice(USERS_NORMAL),
        "log_type": "application",
        "severity": "info",
        "raw_message": (
            f'{src_ip} - - [{ts.strftime("%d/%b/%Y:%H:%M:%S +0000")}] '
            f'"{method} {path} HTTP/1.1" {code} {size} "-" "{ua}"'
        ),
        "is_suspicious": False,
        "note": None,
        "batch_id": None,
        "es_indexed": False,
        "node_id": None,
        "created_at": _fmt_ts(_now_utc()),
    }


def gen_system_normal() -> dict:
    service = random.choice(SERVICES)
    action  = random.choice(["started", "stopped", "reloaded", "restarted"])
    ts      = _random_past(8)
    return {
        "id": str(uuid.uuid4()),
        "timestamp": _fmt_ts(ts),
        "source_ip": "127.0.0.1",
        "dest_ip": random.choice(INTERNAL_IPS),
        "host": random.choice(HOSTS),
        "username": "root",
        "log_type": "system",
        "severity": "info",
        "raw_message": (
            f"systemd[1]: {service}.service {action} successfully."
        ),
        "is_suspicious": False,
        "note": None,
        "batch_id": None,
        "es_indexed": False,
        "node_id": None,
        "created_at": _fmt_ts(_now_utc()),
    }


def gen_auth_normal() -> dict:
    user   = random.choice(USERS_NORMAL)
    src_ip = random.choice(INTERNAL_IPS)
    ts     = _random_past(8)
    return {
        "id": str(uuid.uuid4()),
        "timestamp": _fmt_ts(ts),
        "source_ip": src_ip,
        "dest_ip": random.choice(INTERNAL_IPS),
        "host": random.choice(HOSTS),
        "username": user,
        "log_type": "auth",
        "severity": "info",
        "raw_message": (
            f"Accepted publickey for {user} from {src_ip} port "
            f"{random.randint(40000, 65000)} ssh2: RSA SHA256:xxxx"
        ),
        "is_suspicious": False,
        "note": None,
        "batch_id": None,
        "es_indexed": False,
        "node_id": None,
        "created_at": _fmt_ts(_now_utc()),
    }


def gen_network_normal() -> dict:
    src_ip  = random.choice(INTERNAL_IPS)
    dest_ip = random.choice(INTERNAL_IPS)
    port    = random.choice([80, 443, 5432, 9200, 22])
    ts      = _random_past(8)
    return {
        "id": str(uuid.uuid4()),
        "timestamp": _fmt_ts(ts),
        "source_ip": src_ip,
        "dest_ip": dest_ip,
        "host": random.choice(HOSTS),
        "username": None,
        "log_type": "network",
        "severity": "info",
        "raw_message": (
            f"ALLOW TCP {src_ip}:{random.randint(40000, 65000)} -> "
            f"{dest_ip}:{port} ESTABLISHED"
        ),
        "is_suspicious": False,
        "note": None,
        "batch_id": None,
        "es_indexed": False,
        "node_id": None,
        "created_at": _fmt_ts(_now_utc()),
    }


# ── Générateurs de logs anormaux ─────────────────────────────────────────────

def gen_bruteforce_ssh() -> list[dict]:
    """
    Pattern : rafale de 6-10 échecs SSH depuis la même IP externe en <2 min.
    is_suspicious=True dès le 1er pour que l'agent embarqué les signale.
    """
    src_ip    = random.choice(EXTERNAL_IPS)
    dest_ip   = random.choice(INTERNAL_IPS)
    target    = random.choice(SSH_USERS)
    host      = random.choice(HOSTS)
    n_attempts = random.randint(6, 10)
    base_ts   = _random_past(2)
    logs = []
    for i in range(n_attempts):
        ts = base_ts + timedelta(seconds=i * random.randint(5, 20))
        logs.append({
            "id": str(uuid.uuid4()),
            "timestamp": _fmt_ts(ts),
            "source_ip": src_ip,
            "dest_ip": dest_ip,
            "host": host,
            "username": target,
            "log_type": "auth",
            "severity": "error",
            "raw_message": (
                f"Failed password for {target} from {src_ip} "
                f"port {random.randint(40000, 65000)} ssh2"
            ),
            "is_suspicious": True,
            "note": f"Bruteforce attempt {i+1}/{n_attempts}",
            "batch_id": None,
            "es_indexed": False,
            "node_id": None,
            "created_at": _fmt_ts(_now_utc()),
        })
    logger.warning("[ANOMALIE] Bruteforce SSH généré : %d tentatives depuis %s sur %s",
                   n_attempts, src_ip, target)
    return logs


def gen_admin_access_off_hours() -> dict:
    """Pattern : accès /admin/* en pleine nuit par un compte interne."""
    user   = random.choice(USERS_NORMAL)
    src_ip = random.choice(INTERNAL_IPS)
    path   = random.choice(HTTP_PATHS_SUSPICIOUS)
    ts     = _off_hours_timestamp()
    logger.warning("[ANOMALIE] Accès admin hors heures généré : %s -> %s à %s",
                   user, path, ts.strftime("%H:%M"))
    return {
        "id": str(uuid.uuid4()),
        "timestamp": _fmt_ts(ts),
        "source_ip": src_ip,
        "dest_ip": random.choice(INTERNAL_IPS),
        "host": random.choice(HOSTS),
        "username": user,
        "log_type": "application",
        "severity": "warning",
        "raw_message": (
            f'{ts.strftime("%Y-%m-%d %H:%M:%S")} WARNING [security] '
            f'User {user} accessed {path} from {src_ip}'
        ),
        "is_suspicious": False,   # non flaggé par l'agent (pattern temporel)
        "note": "off-hours access",
        "batch_id": None,
        "es_indexed": False,
        "node_id": None,
        "created_at": _fmt_ts(_now_utc()),
    }


def gen_suspicious_request() -> dict:
    """Pattern : requête vers path suspect avec user-agent d'outil offensif."""
    src_ip = random.choice(EXTERNAL_IPS)
    path   = random.choice(HTTP_PATHS_SUSPICIOUS)
    ua     = random.choice(USER_AGENTS_SUSPICIOUS)
    code   = random.choice([403, 404, 200])
    ts     = _random_past(4)
    logger.warning("[ANOMALIE] Requête suspecte générée : %s %s UA=%s", src_ip, path, ua)
    return {
        "id": str(uuid.uuid4()),
        "timestamp": _fmt_ts(ts),
        "source_ip": src_ip,
        "dest_ip": random.choice(INTERNAL_IPS),
        "host": random.choice(HOSTS),
        "username": None,
        "log_type": "application",
        "severity": "warning" if code != 200 else "error",
        "raw_message": (
            f'{src_ip} - - [{ts.strftime("%d/%b/%Y:%H:%M:%S +0000")}] '
            f'"GET {path} HTTP/1.1" {code} 432 "-" "{ua}"'
        ),
        "is_suspicious": True,
        "note": f"Suspicious tool detected: {ua}",
        "batch_id": None,
        "es_indexed": False,
        "node_id": None,
        "created_at": _fmt_ts(_now_utc()),
    }


def gen_privilege_escalation() -> dict:
    """Pattern : sudo depuis un compte non autorisé."""
    user   = random.choice(USERS_SUSPICIOUS)
    src_ip = random.choice(INTERNAL_IPS)
    cmd    = random.choice(["su root", "sudo bash", "sudo -i", "sudo passwd root"])
    ts     = _random_past(6)
    logger.warning("[ANOMALIE] Élévation de privilèges générée : %s -> %s", user, cmd)
    return {
        "id": str(uuid.uuid4()),
        "timestamp": _fmt_ts(ts),
        "source_ip": src_ip,
        "dest_ip": random.choice(INTERNAL_IPS),
        "host": random.choice(HOSTS),
        "username": user,
        "log_type": "auth",
        "severity": "critical",
        "raw_message": (
            f"sudo: {user} : command not allowed ; TTY=pts/0 ; "
            f"PWD=/home/{user} ; USER=root ; COMMAND={cmd}"
        ),
        "is_suspicious": True,
        "note": "Unauthorized privilege escalation attempt",
        "batch_id": None,
        "es_indexed": False,
        "node_id": None,
        "created_at": _fmt_ts(_now_utc()),
    }


def gen_port_scan() -> list[dict]:
    """Pattern : connexions rapides vers de nombreux ports distincts."""
    src_ip  = random.choice(EXTERNAL_IPS)
    dest_ip = random.choice(INTERNAL_IPS)
    host    = random.choice(HOSTS)
    ports   = random.sample(range(1, 65535), random.randint(15, 30))
    base_ts = _random_past(1)
    logs = []
    for i, port in enumerate(ports):
        ts = base_ts + timedelta(milliseconds=i * 100)
        logs.append({
            "id": str(uuid.uuid4()),
            "timestamp": _fmt_ts(ts),
            "source_ip": src_ip,
            "dest_ip": dest_ip,
            "host": host,
            "username": None,
            "log_type": "network",
            "severity": "warning",
            "raw_message": (
                f"REJECT TCP {src_ip}:{random.randint(40000, 65000)} "
                f"-> {dest_ip}:{port} (port scan detected)"
            ),
            "is_suspicious": True,
            "note": f"Port scan: {len(ports)} ports in <3s",
            "batch_id": None,
            "es_indexed": False,
            "node_id": None,
            "created_at": _fmt_ts(_now_utc()),
        })
    logger.warning("[ANOMALIE] Port scan généré : %d ports depuis %s", len(ports), src_ip)
    return logs


# ── Dispatch par type ─────────────────────────────────────────────────────────

NORMAL_GENERATORS = {
    "application": gen_application_normal,
    "system":      gen_system_normal,
    "auth":        gen_auth_normal,
    "network":     gen_network_normal,
}

ANOMALY_GENERATORS = [
    gen_admin_access_off_hours,
    gen_suspicious_request,
    gen_privilege_escalation,
]


def generate_one_log(log_type: str | None = None, force_anomaly: bool = False) -> list[dict]:
    """Génère un ou plusieurs logs (les patterns bruteforce/portscan en génèrent plusieurs)."""
    is_anomaly = force_anomaly or (random.random() < ANOMALY_RATE)

    if is_anomaly:
        gen = random.choice([
            gen_bruteforce_ssh,
            gen_admin_access_off_hours,
            gen_suspicious_request,
            gen_privilege_escalation,
            gen_port_scan,
        ])
        result = gen()
        return result if isinstance(result, list) else [result]
    else:
        ltype = log_type or random.choice(LOG_TYPES)
        ltype = ltype if ltype in NORMAL_GENERATORS else "application"
        return [NORMAL_GENERATORS[ltype]()]


def generate_dataset(n_total: int = 100, anomaly_ratio: float = 0.2) -> list[dict]:
    """
    Génère un dataset de n_total logs avec anomaly_ratio d'anomalies.
    Les patterns multi-logs (bruteforce, scan) sont regroupés et comptent
    comme un seul 'événement' pour le ratio.
    """
    n_anomalies = int(n_total * anomaly_ratio)
    n_normal    = n_total - n_anomalies
    logs: list[dict] = []

    for _ in range(n_normal):
        logs.extend(generate_one_log(force_anomaly=False))

    for _ in range(n_anomalies):
        logs.extend(generate_one_log(force_anomaly=True))

    random.shuffle(logs)
    logger.info("Dataset généré : %d logs (dont %d anomalies demandées)",
                len(logs), n_anomalies)
    return logs


# ── Envoi HTTP ────────────────────────────────────────────────────────────────

def send_log(log: dict, session: requests.Session) -> bool:
    url = f"{BACKEND_URL}/api/v1/logs"
    try:
        resp = session.post(url, json=log, timeout=5)
        if resp.status_code in (200, 201):
            logger.info("✓ Log envoyé [%s] %s sev=%s",
                        log["log_type"], log["id"][:8], log["severity"])
            return True
        else:
            logger.error("✗ Erreur HTTP %d pour log %s : %s",
                         resp.status_code, log["id"][:8], resp.text[:100])
            return False
    except requests.exceptions.ConnectionError:
        logger.error("✗ Backend inaccessible : %s", url)
        return False
    except Exception:
        logger.exception("✗ Erreur inattendue envoi log %s", log["id"][:8])
        return False


def send_batch(logs: list[dict], batch_id: str | None = None) -> dict:
    """Envoie un batch de logs, tous avec le même batch_id."""
    bid = batch_id or str(uuid.uuid4())[:8]
    for log in logs:
        log["batch_id"] = bid

    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})

    ok = err = 0
    for log in logs:
        if send_log(log, session):
            ok += 1
        else:
            err += 1

    logger.info("Batch %s terminé : %d OK / %d erreurs", bid, ok, err)
    return {"batch_id": bid, "sent": ok, "errors": err}


# ── Modes d'exécution ─────────────────────────────────────────────────────────

def mode_generate(output_path: str = "sample_logs.json") -> None:
    """Génère 100 logs (80 normaux + 20 anormaux) et les sauvegarde en JSON."""
    logs = generate_dataset(n_total=100, anomaly_ratio=0.2)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(logs, f, ensure_ascii=False, indent=2)
    logger.info("sample_logs.json sauvegardé : %d logs", len(logs))
    # Résumé normal vs anormal
    n_sus = sum(1 for l in logs if l["is_suspicious"])
    logger.info("  → %d marqués is_suspicious=True (bruteforce/scan/privesc)", n_sus)
    logger.info("  → %d non flaggés par agent (off-hours, patterns temporels)", len(logs) - n_sus)


def mode_batch(n: int = 100) -> None:
    """Génère et envoie un batch de n logs."""
    logs = generate_dataset(n_total=n, anomaly_ratio=ANOMALY_RATE)
    result = send_batch(logs)
    print(json.dumps(result, indent=2))


def mode_continuous() -> None:
    """Flux continu : envoie LOG_RATE logs par seconde jusqu'à Ctrl+C."""
    logger.info("Mode continu démarré (%.1f logs/sec) — Ctrl+C pour arrêter", LOG_RATE)
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    interval = 1.0 / LOG_RATE
    total = 0
    try:
        while True:
            logs = generate_one_log()
            for log in logs:
                send_log(log, session)
                total += 1
            time.sleep(interval)
    except KeyboardInterrupt:
        logger.info("Flux continu arrêté. Total envoyé : %d logs", total)


# ── Point d'entrée ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Simulateur de logs CTU-SIEM")
    parser.add_argument(
        "--mode",
        choices=["batch", "continuous", "generate"],
        default="generate",
        help="Mode d'exécution (défaut: generate)",
    )
    parser.add_argument("--n", type=int, default=100,
                        help="Nombre de logs à générer/envoyer (mode batch)")
    parser.add_argument("--output", type=str, default="sample_logs.json",
                        help="Fichier de sortie (mode generate)")
    args = parser.parse_args()

    if args.mode == "generate":
        mode_generate(args.output)
    elif args.mode == "batch":
        mode_batch(args.n)
    elif args.mode == "continuous":
        mode_continuous()
