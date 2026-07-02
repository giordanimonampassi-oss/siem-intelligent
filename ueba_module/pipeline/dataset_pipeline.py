"""
pipeline/dataset_pipeline.py

PIPELINE TEXTUELLE : charge openssh.txt (Loghub) depuis le dossier LOGHUB_2_EXTRACTED sur le Desktop,
le parse au format JSON cible (severity, log_type, source_ip, raw_message),
extrait des indicateurs simples pour l'Isolation Forest et sauvegarde le résultat sur le disque.
"""
from __future__ import annotations

import os
from pathlib import Path
import re
import pandas as pd

from utils.logger import get_logger

logger = get_logger(__name__)

# Regex pour extraire l'IP dans openssh.txt (gère les formats from, rhost=, et [IP])
IP_PATTERN = re.compile(r'(?:from\s+|rhost=|\s+\[)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})')

def build_baseline_features(log_path: Path | None = None) -> pd.DataFrame:
    """
    Charge openssh.txt depuis le dossier LOGHUB_2_EXTRACTED sur le Bureau,
    applique le parser regex et génère un DataFrame structuré au format cible.
    """
    # Ciblage précis du dossier LOGHUB_2_EXTRACTED sur le Bureau
    if log_path is None:
        desktop_path = Path(os.path.expanduser("~")) / "Desktop"
        log_path = desktop_path / "LOGHUB_2_EXTRACTED" / "openssh.txt"
    else:
        log_path = Path(log_path)

    if not log_path.exists():
        raise FileNotFoundError(
            f"Fichier Loghub introuvable à l'emplacement : {log_path}\n"
            f"Vérifie que le dossier 'LOGHUB_2_EXTRACTED' contient bien le fichier 'openssh.txt' sur ton Bureau."
        )

    logger.info("Chargement des logs Loghub depuis %s ...", log_path)
    
    parsed_records = []
    total_lines = 0

    # Lecture ligne par ligne
    with open(log_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            
            total_lines += 1
            
            try:
                # Séparation de l'entête syslog et du message sshd
                parts = line.split(" sshd[", 1)
                if len(parts) < 2:
                    continue
                
                pid_and_message = parts[1].split("]: ", 1)
                if len(pid_and_message) < 2:
                    continue
                
                pid = pid_and_message[0]
                message_content = pid_and_message[1].strip()
                
                # 1. Détermination de la sévérité
                severity = "info"
                if any(kw in message_content for kw in ["Failed", "Invalid", "invalid", "failure", "BREAK-IN", "Too many"]):
                    severity = "error"
                    
                # 2. Extraction de l'IP source
                ip_match = IP_PATTERN.search(line)
                source_ip = ip_match.group(1) if ip_match else "unknown"
                
                # 3. Création de l'enregistrement au format JSON cible
                record = {
                    "severity": severity,
                    "log_type": "auth",
                    "source_ip": source_ip,
                    "raw_message": f"sshd[{pid}]: {message_content}"
                }
                parsed_records.append(record)
                
            except Exception:
                continue

            if total_lines % 50_000 == 0:
                logger.info(" %d lignes lues, %d logs valides extraits", total_lines, len(parsed_records))

    # Conversion en DataFrame
    df = pd.DataFrame(parsed_records)
    logger.info("Logs Loghub chargés : %d lignes structurées", len(df))
    
    # Pre-processing requis pour l'Isolation Forest (Valeurs numériques obligatoires)
    df["severity_encoded"] = df["severity"].apply(lambda x: 1 if x == "error" else 0)
    df["message_length"] = df["raw_message"].str.len()
    
    return df


if __name__ == "__main__":
    try:
        # 1. Extraction et structuration des données en mémoire
        feats = build_baseline_features()
        
        # 2. Définition du dossier et sauvegarde sur le disque dur
        output_dir = Path("data/1_baseline")
        output_dir.mkdir(parents=True, exist_ok=True)  # Crée le dossier s'il n'existe pas encore
        output_path = output_dir / "baseline_logs.csv"
        
        logger.info("Sauvegarde du nouveau dataset sur le disque dur dans %s ...", output_path)
        feats.to_csv(output_path, index=False)
        logger.info("Sauvegarde réussie ! Le fichier est maintenant persistant.")

        # 3. Affichage de l'aperçu de contrôle
        print("\nAperçu du DataFrame généré et sauvegardé :")
        print(feats[["severity", "log_type", "source_ip", "severity_encoded", "message_length"]].head(10))
        print(f"\nTotal : {len(feats)} lignes enregistrées dans 'data/1_baseline/baseline_logs.csv'.")
        
    except Exception as e:
        print(f"Erreur : {e}")