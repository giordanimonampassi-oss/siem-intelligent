from datetime import datetime, timezone
from elasticsearch import Elasticsearch

def inject_massive_attack():
    client = Elasticsearch("http://localhost:9200")
    print("Génération d'un bruteforce volumétrique massif (500 logs)...")
    
    # 500 tentatives répétées vont drastiquement modifier les statistiques de cette IP
    for i in range(500):
        log = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "log_type": "auth",
            "severity": "critical",
            "source_ip": "203.0.113.45",
            "dest_ip": "10.0.0.4",
            "host": "srv-ssh-prod",
            "username": "root",
            "raw_message": f"Failed password for root from 203.0.113.45 port {40000 + i} ssh2"
        }
        client.index(index="siem-logs", document=log)
        
    print("Injection réussie ! 500 logs d'attaque poussés dans Elasticsearch.")

if __name__ == "__main__":
    inject_massive_attack()
