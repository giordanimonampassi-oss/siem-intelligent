from __future__ import annotations
from datetime import datetime, timedelta, timezone
import pandas as pd
from elasticsearch import Elasticsearch
from elasticsearch.helpers import scan
from config import ES_CONFIG, PIPELINE_CONFIG, RAW_LOG_COLUMNS
from utils.logger import get_logger

logger = get_logger(__name__)


def get_es_client() -> Elasticsearch:
    try:
        host = ES_CONFIG.host
        kwargs = {"request_timeout": 30}
        
        # Le client v8 gère parfaitement l'absence de mot de passe si configuré ainsi
        if getattr(ES_CONFIG, "user", None) and getattr(ES_CONFIG, "password", None):
            if str(ES_CONFIG.password).strip():
                kwargs["basic_auth"] = (ES_CONFIG.user, ES_CONFIG.password)
                
        client = Elasticsearch(host, **kwargs)
        if not client.ping():
            raise ConnectionError("Ping Elasticsearch echoue")
        logger.info("Connexion ES OK sur %s", host)
        return client
    except Exception:
        logger.exception("Impossible de se connecter a Elasticsearch")
        raise


def _build_time_range_query(window_minutes: int) -> dict:
    now = datetime.now(timezone.utc)
    start = now - timedelta(minutes=window_minutes)
    return {"query": {"range": {"timestamp": {"gte": start.isoformat(), "lte": now.isoformat()}}}}


def extract_recent_logs(window_minutes=None, index=None, client=None) -> pd.DataFrame:
    window_minutes = window_minutes or PIPELINE_CONFIG.extraction_window_minutes
    index = index or ES_CONFIG.index
    client = client or get_es_client()
    query = _build_time_range_query(window_minutes)
    logger.info("Extraction ES : %d dernieres minutes (index=%s)", window_minutes, index)
    try:
        hits = list(scan(client, index=index, query=query, preserve_order=True))
    except Exception:
        logger.exception("Echec extraction Elasticsearch")
        raise
    if not hits:
        logger.warning("Aucun log trouve sur la fenetre demandee")
        return pd.DataFrame(columns=RAW_LOG_COLUMNS)
    rows = [hit["_source"] for hit in hits]
    df = pd.DataFrame(rows)
    for col in [c for c in RAW_LOG_COLUMNS if c not in df.columns]:
        df[col] = None
    df = df[RAW_LOG_COLUMNS]
    logger.info("Extraction terminee : %d documents", len(df))
    return df


def extract_by_id_range(start_id, end_id=None, index=None, client=None) -> pd.DataFrame:
    index = index or ES_CONFIG.index
    client = client or get_es_client()
    must = [{"term": {"batch_id": start_id}}]
    if end_id:
        must.append({"term": {"batch_id": end_id}})
    hits = list(scan(client, index=index, query={"query": {"bool": {"should": must}}}, preserve_order=True))
    rows = [hit["_source"] for hit in hits]
    df = pd.DataFrame(rows) if rows else pd.DataFrame(columns=RAW_LOG_COLUMNS)
    logger.info("Extraction par batch_id : %d documents", len(df))
    return df


if __name__ == "__main__":
    df = extract_recent_logs()
    print(df.head())
