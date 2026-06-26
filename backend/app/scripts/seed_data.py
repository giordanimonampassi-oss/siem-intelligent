"""
Seed data — 1000 logs simulés CTU.
Usage : python scripts/seed_data.py  (depuis backend/)
"""
import asyncio, random, sys, os, uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

env_path = PROJECT_ROOT / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=env_path, override=True)

print(f"[ENV] DATABASE_URL    : {os.environ.get('DATABASE_URL','?')}")
print(f"[ENV] ELASTICSEARCH   : {os.environ.get('ELASTICSEARCH_URL','?')}")

from db.database import AsyncSessionLocal, es_client, init_db, init_elasticsearch
from services.log_service import ingest_batch
from schemas.log_schemas import LogIngest, LogBatchIngest
from core.constants import LogType, LogSeverity

HOSTS    = ["ctu-srv-01","ctu-srv-02","ctu-ws-012","ctu-archive",
            "ctu-fw-01","ctu-vpn","ctu-dmz","nmyers-ws","jbauer-laptop"]
USERS    = ["c.obrian","j.bauer","t.almeida","e.stiles","n.myers","b.buchanan"]
IPS_INT  = ["10.0.1.12","10.0.1.22","10.0.1.45","10.0.1.55","192.168.5.22"]
IPS_EXT  = ["178.43.12.87","203.12.44.91","94.130.5.2","41.77.12.3","185.22.4.11"]

NORMAL = [
    (LogType.AUTH,        LogSeverity.INFO,    "Accepted password for {u} from {ip} port 22 ssh2"),
    (LogType.AUTH,        LogSeverity.INFO,    "session opened for user {u} by uid 0"),
    (LogType.NETWORK,     LogSeverity.INFO,    "ACCEPT tcp {ip}:55423 to 10.0.0.1:443"),
    (LogType.NETWORK,     LogSeverity.INFO,    "VPN session established {u} from {ip}"),
    (LogType.SYSTEM,      LogSeverity.INFO,    "systemd: Started Daily apt upgrade"),
    (LogType.APPLICATION, LogSeverity.INFO,    "GET /api/v1/health HTTP/1.1 200 OK"),
    (LogType.AUTH,        LogSeverity.WARNING, "Failed password for {u} from {ip} port 34521"),
    (LogType.NETWORK,     LogSeverity.WARNING, "Firewall DROP tcp {ip} to 10.0.0.1:445"),
    (LogType.SYSTEM,      LogSeverity.WARNING, "Disk usage /var/log at 85 percent"),
    (LogType.AUTH,        LogSeverity.INFO,    "Logout user {u} from {ip}"),
]

ATTACKS = [
    (LogType.AUTH,        LogSeverity.CRITICAL, "Failed password for root from 178.43.12.87 port 53241 ssh2"),
    (LogType.AUTH,        LogSeverity.CRITICAL, "Failed password for admin from 178.43.12.87 port 53239 ssh2"),
    (LogType.AUTH,        LogSeverity.CRITICAL, "maximum authentication attempts exceeded for root from 178.43.12.87"),
    (LogType.AUTH,        LogSeverity.CRITICAL, "NTLM pass-the-hash authentication CTU jsmith from 10.0.1.45 to ctu-ws-012"),
    (LogType.AUTH,        LogSeverity.WARNING,  "Unusual NTLM authentication 10.0.1.45 to 10.0.1.55"),
    (LogType.AUTH,        LogSeverity.WARNING,  "Login n.myers at 02:47 outside normal hours baseline 08-18"),
    (LogType.APPLICATION, LogSeverity.CRITICAL, "Data transfer 9.4 GB in 12min by n.myers 12x baseline exceeded"),
    (LogType.SYSTEM,      LogSeverity.CRITICAL, "Access attempt encrypted partition classified by n.myers out of scope"),
]

def rand_ts(days=30):
    return datetime.now(timezone.utc) - timedelta(
        days=random.randint(0,days), hours=random.randint(0,23),
        minutes=random.randint(0,59), seconds=random.randint(0,59)
    )

def make(tpl, ext=False):
    lt, sev, msg = tpl
    ip = random.choice(IPS_EXT if ext else IPS_INT+IPS_EXT)
    u  = random.choice(USERS)
    return LogIngest(
        timestamp=rand_ts(), source_ip=ip, host=random.choice(HOSTS),
        username=u, log_type=lt, severity=sev,
        raw_message=msg.format(u=u, ip=ip),
    )

async def check():
    import psycopg, re
    db_url = os.environ.get("DATABASE_URL","")
    # psycopg DSN format
    m = re.match(r"postgresql\+psycopg://([^:]+):([^@]+)@([^:/]+):?(\d+)?/(.+)", db_url)
    if not m:
        print(f"[ERREUR] DATABASE_URL mal formatée : {db_url}")
        return False
    user, pwd, host, port, dbname = m.groups()
    dsn = f"host={host} port={port or 5432} user={user} password={pwd} dbname={dbname}"
    print(f"[CHECK] Test PG : {host}:{port or 5432}/{dbname}")
    try:
        conn = await psycopg.AsyncConnection.connect(dsn)
        ver = await (await conn.execute("SELECT version()")).fetchone()
        await conn.close()
        print(f"[OK] PostgreSQL : {ver[0][:60]}")
    except Exception as e:
        print(f"[ERREUR] PostgreSQL : {e}")
        return False
    try:
        if await es_client.ping():
            info = await es_client.info()
            print(f"[OK] Elasticsearch : {info['version']['number']}")
        else:
            print("[ERREUR] ES ping failed")
            return False
    except Exception as e:
        print(f"[ERREUR] Elasticsearch : {e}")
        return False
    return True

async def seed():
    ok = await check()
    if not ok:
        await es_client.close(); return

    await init_db()
    await init_elasticsearch()
    print(f"\n[SEED] Génération de 1000 logs...")

    logs = [make(random.choice(NORMAL)) for _ in range(900)]
    logs += [make(random.choice(ATTACKS), ext=True) for _ in range(100)]
    random.shuffle(logs)

    async with AsyncSessionLocal() as db:
        for i in range(0, len(logs), 100):
            chunk = logs[i:i+100]
            batch = LogBatchIngest(logs=chunk, batch_id=f"SEED-{i//100+1:02d}")
            r = await ingest_batch(batch, db, es_client)
            print(f"  {r['batch_id']} : {r['ingested']} logs | "
                  f"{r['critical']} critical | {r['warning']} warning | "
                  f"ES:{r['es_indexed']} | SHA256:{r['sha256'][:16]}...")

    await es_client.close()
    print("\n✅ Seed terminé — 1000 logs dans PostgreSQL + Elasticsearch")
    print("   Attaques cachées : Brute Force SSH | Mouvement latéral NTLM | Exfiltration n.myers")

if __name__ == "__main__":
    # Correction spécifique pour Psycopg3 / Windows asynchrone
    if sys.platform == "win32":
        import selectors
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
asyncio.run(seed())