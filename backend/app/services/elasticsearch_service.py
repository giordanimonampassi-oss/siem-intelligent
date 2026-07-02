"""
Acces aux logs bruts stockes dans Elasticsearch.

Les incidents (Postgres) ne referencent que des IDs de documents ES.
Ce module fait le pont entre les deux : recuperer les evenements corrigees
lors de la creation d'un incident, et le pivot d'investigation (section 4.6).
"""
import os
from elasticsearch import Elasticsearch

ES_HOST = os.getenv("ELASTICSEARCH_URL", "http://elasticsearch:9200")
LOGS_INDEX = os.getenv("ES_LOGS_INDEX", "siem-logs-*")

es_client = Elasticsearch(ES_HOST)

# Mapping champ normalise -> nom de champ ES (cf. pipeline de normalisation 4.1)
ENTITY_FIELD_MAP = {
    "ip": "source_ip",
    "utilisateur": "user",
    "compte_service": "user",
    "machine": "host",
}


def get_events_by_ids(event_ids: list[str]) -> list[dict]:
    """Recupere les documents de logs correspondant aux IDs correles d'un incident."""
    if not event_ids:
        return []
    resp = es_client.search(
        index=LOGS_INDEX,
        body={
            "query": {"ids": {"values": event_ids}},
            "sort": [{"timestamp": {"order": "asc"}}],
            "size": len(event_ids),
        },
    )
    return [{"id": hit["_id"], **hit["_source"]} for hit in resp["hits"]["hits"]]


def pivot_on_entity(entity_type: str, entity_value: str, hours: int = 24, size: int = 200) -> list[dict]:
    """
    Bouton "Pivoter sur cet indicateur" (section 4.6) : recherche tous les
    evenements lies a une entite (IP, utilisateur, machine) sur une fenetre glissante.
    """
    field = ENTITY_FIELD_MAP.get(entity_type, "source_ip")

    resp = es_client.search(
        index=LOGS_INDEX,
        body={
            "query": {
                "bool": {
                    "must": [{"term": {f"{field}.keyword": entity_value}}],
                    "filter": [{"range": {"timestamp": {"gte": f"now-{hours}h"}}}],
                }
            },
            "sort": [{"timestamp": {"order": "asc"}}],
            "size": size,
        },
    )
    return [{"id": hit["_id"], **hit["_source"]} for hit in resp["hits"]["hits"]]