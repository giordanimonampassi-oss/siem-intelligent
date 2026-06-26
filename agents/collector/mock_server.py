"""
Serveur mock : remplace temporairement la vraie API FastAPI du Backend,
le temps qu'elle soit prete. Sert UNIQUEMENT a verifier que l'agent
envoie bien des logs au bon format, conforme au contrat JSON.

Pour basculer sur la vraie API plus tard : il suffit de changer
"server_url" dans config.yaml. Aucun code de l'agent n'a besoin de changer.

Lancement :
    pip install fastapi uvicorn
    uvicorn mock_server:app --host 0.0.0.0 --port 8000
"""

import json
from datetime import datetime, timezone

from fastapi import FastAPI

app = FastAPI()

# Tous les logs recus sont aussi sauvegardes ici, pour pouvoir les
# relire et les compter facilement apres un test.
FICHIER_LOGS_RECUS = "mock_received_logs.jsonl"


@app.post("/api/v1/logs")
def recevoir_log(log: dict):
    """Recoit un log envoye par l'agent, l'affiche et le sauvegarde."""

    print(f"[mock-server] Log recu : {log}")

    with open(FICHIER_LOGS_RECUS, "a", encoding="utf-8") as f:
        f.write(json.dumps(log) + "\n")

    return {
        "id": f"mock-{datetime.now(timezone.utc).timestamp():.0f}",
        "status": "ok",
    }
