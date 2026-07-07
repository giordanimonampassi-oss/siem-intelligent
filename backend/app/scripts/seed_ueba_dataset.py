"""
Script de seed — genere 30 jours de logs comportementaux CTU avec 3 attaques
cachees, conformement au cahier des charges (Annexe : "Dataset CTU simule").

Attaques cachees :
  - Jour 10 : Brute-force SSH (Scenario S3, Chloe)          -> MITRE T1110
  - Jour 20 : Mouvement lateral / Pass-the-Hash (S6, Tony)   -> MITRE T1550
  - Jours 25-27 : Exfiltration lente (S7, Nina Myers)        -> MITRE T1041

A placer dans le dossier scripts/ de ton backend et lancer depuis la racine
du projet (la ou se trouve db/, models/, services/, core/) :

    python -m scripts.seed_ueba_dataset

Prerequis :
  - .env configure (DATABASE_URL) et Postgres accessible
  - Le patch bootstrap_baselines (usual_hosts) applique dans ueba_service.py
"""
import asyncio
import random
from datetime import datetime, timedelta, timezone
import sys

from db.database import AsyncSessionLocal, init_db
from models.log_entry import LogEntry
from core.constants import LogType, LogSeverity

if sys.platform == "win32": asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())  # fix asyncio sur Windows

random.seed(42)  # reproductible d'un run a l'autre

NOW         = datetime.now(timezone.utc)
WINDOW_DAYS = 30
START       = NOW - timedelta(days=WINDOW_DAYS)
ATTACKER_IP = "178.43.12.87"

USERS = {
    "chloe.obrien":  {"usual_hour": 7, "hosts": ["ctu-analysis-01", "ctu-dashboard"]},
    "jack.bauer":    {"usual_hour": 6, "hosts": ["ctu-field-vpn", "ctu-mobile-term"]},
    "tony.almeida":  {"usual_hour": 8, "hosts": ["ctu-ops-01", "ctu-intel-db"]},
    "edgar.stiles":  {"usual_hour": 9, "hosts": ["ctu-infra-01", "ctu-syslog-srv"]},
    "aaron.pierce":  {"usual_hour": 7, "hosts": ["ctu-physec-01"]},
    "nina.myers":    {"usual_hour": 9, "hosts": ["ctu-analysis-02", "ctu-archive-restricted"]},
    "bill.buchanan": {"usual_hour": 8, "hosts": ["ctu-director-01"]},
}
LOG_TYPES = [LogType.AUTH.value, LogType.NETWORK.value, LogType.SYSTEM.value, LogType.APPLICATION.value]


def _ts(day_offset: float, hour: float, jitter_min: int = 0) -> datetime:
    base = START + timedelta(days=day_offset, hours=hour)
    if jitter_min:
        base += timedelta(minutes=random.uniform(-jitter_min, jitter_min))
    return base


def _mk_log(ts, username=None, host=None, source_ip=None,
            log_type=LogType.SYSTEM.value, severity=LogSeverity.INFO.value,
            message="", suspicious=False) -> LogEntry:
    return LogEntry(
        timestamp=ts, username=username, host=host, source_ip=source_ip,
        log_type=log_type, severity=severity, raw_message=message,
        is_suspicious=suspicious, batch_id="seed-ueba-30j",
    )


# ─── Trafic normal (baseline comportementale) ─────────────────────────────

def generate_normal_traffic() -> list[LogEntry]:
    logs = []
    for day in range(WINDOW_DAYS):
        for username, profile in USERS.items():
            if random.random() < 0.1:
                continue  # jour d'absence simule
            hour = profile["usual_hour"] + random.uniform(-0.5, 0.5)
            host = random.choice(profile["hosts"])
            logs.append(_mk_log(
                _ts(day, hour), username=username, host=host,
                log_type=LogType.AUTH.value, severity=LogSeverity.INFO.value,
                message=f"Authentification reussie de {username} sur {host}",
            ))
            for _ in range(random.randint(3, 8)):
                logs.append(_mk_log(
                    _ts(day, hour + random.uniform(0.2, 6)), username=username, host=host,
                    log_type=random.choice(LOG_TYPES), severity=LogSeverity.INFO.value,
                    message=f"Activite normale de {username} sur {host}",
                ))
    return logs


# ─── Attaque 1 : Brute-force SSH (Scenario S3, MITRE T1110) ───────────────

def generate_bruteforce_attack(day: int = 10) -> list[LogEntry]:
    logs = []
    target = "ctu-fw-edge"
    base = _ts(day, 6.23)  # ~6h14, cf. narration
    for i in range(6):
        logs.append(_mk_log(
            base + timedelta(seconds=i * 8), host=target, source_ip=ATTACKER_IP,
            log_type=LogType.AUTH.value, severity=LogSeverity.WARNING.value,
            message=f"Echec d'authentification SSH depuis {ATTACKER_IP}",
            suspicious=True,
        ))
    logs.append(_mk_log(
        base + timedelta(minutes=2), username="svc-legacy", host="ctu-ad-01", source_ip=ATTACKER_IP,
        log_type=LogType.AUTH.value, severity=LogSeverity.CRITICAL.value,
        message=f"Authentification reussie d'un compte de service depuis le sous-reseau de {ATTACKER_IP}",
        suspicious=True,
    ))
    return logs


# ─── Attaque 2 : Mouvement lateral / Pass-the-Hash (Scenario S6, T1550) ───

def generate_lateral_movement(day: int = 20) -> list[LogEntry]:
    logs = []
    ts = _ts(day, 23.78)  # 23h47
    logs.append(_mk_log(
        ts, username="tony.almeida", host="ctu-intel-db", source_ip="10.10.4.17",
        log_type=LogType.AUTH.value, severity=LogSeverity.CRITICAL.value,
        message="Authentification NTLM inhabituelle — machine normalement inactive a cette heure",
        suspicious=True,
    ))
    logs.append(_mk_log(
        ts + timedelta(minutes=3), username="tony.almeida", host="ctu-ops-01", source_ip="10.10.4.17",
        log_type=LogType.NETWORK.value, severity=LogSeverity.WARNING.value,
        message="Pivot lateral detecte vers un second hote interne",
        suspicious=True,
    ))
    return logs


# ─── Attaque 3 : Exfiltration lente — Nina Myers (Scenario S7, T1041) ─────

def generate_nina_exfiltration() -> list[LogEntry]:
    """
    Etalee sur 3 nuits avec escalade progressive du volume, pour que le
    risk_score grimpe au fil des anomalies (12 -> 47 -> 78 -> 94 dans la
    narration). La 3e nuit ajoute un acces hors perimetre habituel.
    """
    logs = []
    for i, day in enumerate([25, 26, 27]):
        ts = _ts(day, 2.78)  # 2h47
        logs.append(_mk_log(
            ts, username="nina.myers", host="ctu-analysis-02",
            log_type=LogType.AUTH.value, severity=LogSeverity.WARNING.value,
            message="Connexion hors horaires habituels",
            suspicious=True,
        ))
        n_files = 200 + i * 320  # volume croissant chaque nuit
        logs.append(_mk_log(
            ts + timedelta(minutes=6), username="nina.myers", host="ctu-archive-restricted",
            log_type=LogType.APPLICATION.value, severity=LogSeverity.CRITICAL.value,
            message="F" * (n_files * 50),  # proxy de volume via la taille du message
            suspicious=True,
        ))
        if day == 27:
            logs.append(_mk_log(
                ts + timedelta(minutes=14), username="nina.myers", host="ctu-classified-partition",
                log_type=LogType.SYSTEM.value, severity=LogSeverity.CRITICAL.value,
                message="Tentative d'acces a une partition chiffree hors perimetre habituel",
                suspicious=True,
            ))
    return logs


# ─── Orchestration ──────────────────────────────────────────────────────────

async def seed():
    await init_db()
    async with AsyncSessionLocal() as db:
        logs  = generate_normal_traffic()
        logs += generate_bruteforce_attack()
        logs += generate_lateral_movement()
        logs += generate_nina_exfiltration()

        print(f"Insertion de {len(logs)} logs sur {WINDOW_DAYS} jours...")
        db.add_all(logs)
        await db.commit()
        print("Logs inseres avec succes.\n")

        from services.ueba_service import bootstrap_baselines, snapshot_all_profiles
        from services.anomaly_detector import run_batch_detection

        result = await bootstrap_baselines(db, window_days=WINDOW_DAYS)
        print(f"Baselines calculees : {result}")

        count = await run_batch_detection(db, lookback_seconds=3600 * 24 * 40)
        print(f"{count} anomalie(s) detectee(s) par le detecteur comportemental.")

        snaps = await snapshot_all_profiles(db)
        print(f"{snaps} profil(s) snapshote(s) pour aujourd'hui.\n")

        print("Verifie ensuite :")
        print("  - GET /ueba/profiles/nina.myers          -> risk_score eleve")
        print("  - GET /ueba/profiles/nina.myers/anomalies -> 3 types d'anomalies")
        print("  - GET /alerts?severity=CRITICAL           -> alerte auto-creee si seuil franchi")


if __name__ == "__main__":
    asyncio.run(seed())