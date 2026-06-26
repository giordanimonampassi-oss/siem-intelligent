"""
Service de normalisation — Module 1.
Détection automatique du type et de la sévérité depuis le message brut.
Les valeurs déclarées par l'agent ont la priorité.
"""
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from core.constants import LogSeverity, LogType
from schemas.log_schemas import LogIngest

# Patterns de détection du type de log
_TYPE_PATTERNS: Dict[LogType, list] = {
    LogType.AUTH: [
        r"ssh|sshd|pam|login|logout|password|authentication|sudo|su\b|badge",
        r"failed.{0,20}(password|login)|accepted.{0,20}password",
        r"\b(4624|4625|4634|4648|4768|4769|4771)\b",   # EventIDs Windows
        r"ntlm|kerberos|ldap.*auth",
    ],
    LogType.NETWORK: [
        r"firewall|iptables|netfilter|tcp|udp|icmp|port\s+\d+",
        r"connection.{0,20}(refused|established|closed|reset|drop)",
        r"\b(DENY|ACCEPT|DROP|FORWARD|BLOCK)\b",
        r"vpn|tunnel|proxy|nat\b",
    ],
    LogType.APPLICATION: [
        r"\b(GET|POST|PUT|DELETE|PATCH)\s+/",
        r"http|apache|nginx|tomcat|django|flask|rails|express",
        r"\b(500|404|403|401|400)\s+(Internal|Not Found|Forbidden|Unauthorized|Bad Request)",
        r"api\b|endpoint|request|response",
    ],
    LogType.CLOUD: [
        r"aws|azure|gcp|cloudtrail|s3|ec2|lambda|blob|cosmos",
        r"iam|role.{0,10}assum|policy|bucket",
    ],
}

# Mots-clés de sévérité
_CRIT_PATTERNS  = r"emerg|alert|crit|critical|fatal|panic|attack|intrusion|malware|ransomware|exfil"
_WARN_PATTERNS  = r"warn|error|err\b|fail|denied|refused|blocked|drop|invalid|exceeded|breach"


def detect_log_type(raw: str) -> LogType:
    msg = raw.lower()
    for log_type, patterns in _TYPE_PATTERNS.items():
        if any(re.search(p, msg, re.IGNORECASE) for p in patterns):
            return log_type
    return LogType.SYSTEM


def detect_severity(raw: str, declared: Optional[LogSeverity] = None) -> LogSeverity:
    # La sévérité déclarée par l'agent prime toujours
    if declared and declared != LogSeverity.INFO:
        return declared
    msg = raw.lower()
    if re.search(_CRIT_PATTERNS, msg):
        return LogSeverity.CRITICAL
    if re.search(_WARN_PATTERNS, msg):
        return LogSeverity.WARNING
    return LogSeverity.INFO


def extract_ip(raw: str) -> Optional[str]:
    """Tente d'extraire l'IP source depuis le message brut."""
    # Priorité : "from X.X.X.X"
    m = re.search(r"from\s+(\d{1,3}(?:\.\d{1,3}){3})", raw, re.IGNORECASE)
    if m:
        return m.group(1)
    # Fallback : première IP du message
    ips = re.findall(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b", raw)
    # Exclure les IPs de loopback et broadcast
    for ip in ips:
        if not ip.startswith(("127.", "255.", "0.")):
            return ip
    return None


def normalize(payload: LogIngest) -> Dict[str, Any]:
    """
    Pipeline de normalisation complet.
    Retourne un dict prêt pour LogEntry(**data).
    """
    # Timestamp
    ts = payload.timestamp or datetime.now(timezone.utc)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)

    # IP source
    source_ip = payload.source_ip or extract_ip(payload.raw_message)

    # Type et sévérité — déclarés ou auto-détectés
    log_type = payload.log_type or detect_log_type(payload.raw_message)
    severity = detect_severity(payload.raw_message, payload.severity)

    return {
        "timestamp":   ts,
        "source_ip":   source_ip,
        "dest_ip":     payload.dest_ip,
        "host":        payload.host,
        "username":    payload.username,
        "log_type":    log_type,
        "severity":    severity,
        "raw_message": payload.raw_message,
        "batch_id":    payload.batch_id,
        "node_id":     payload.node_id,
    }