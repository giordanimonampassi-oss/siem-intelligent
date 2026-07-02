from datetime import datetime, timezone
from elasticsearch import Elasticsearch

def inject_mixed():
    client = Elasticsearch("http://localhost:9200")
    
    mixed_logs = [
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "log_type": "auth",
            "severity": "error",
            "source_ip": "203.0.113.45",
            "dest_ip": "10.0.0.4",
            "host": "srv-ssh-prod",
            "username": "root",
            "raw_message": "Failed password for root from 203.0.113.45 port 22 ssh2"
        },
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "log_type": "application",
            "severity": "info",
            "source_ip": "192.168.6.10",
            "dest_ip": "10.0.0.12",
            "host": "web-dashboard",
            "username": "user1",
            "raw_message": "GET /api/v1/dashboard HTTP/1.1 200 1024"
        },
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "log_type": "application",
            "severity": "warning",
            "source_ip": "192.168.1.100",
            "dest_ip": "10.0.0.12",
            "host": "web-dashboard",
            "username": "john.doe",
            "raw_message": "User john.doe accessed /admin/database at 03:21"
        },
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "log_type": "application",
            "severity": "warning",
            "source_ip": "185.220.101.32",
            "dest_ip": "10.0.0.22",
            "host": "api-gateway",
            "username": "anonymous",
            "raw_message": "GET /config HTTP/1.1 403 sqlmap/1.7"
        }
    ]
    
    for log in mixed_logs:
        client.index(index="siem-logs", document=log)
        
    print("Injection réussie de 4 logs de test (Normal & Suspects) dans Elasticsearch.")

if __name__ == "__main__":
    inject_mixed()
