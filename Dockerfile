# ── Stage : runtime ────────────────────────────────────────────────────────
FROM python:3.11-slim

# Métadonnées
LABEL maintainer="Smart SIEM Team"
LABEL description="Service d'initialisation PostgreSQL pour le Smart SIEM CTU"

# Empêche Python de bufferiser stdout/stderr (logs visibles en temps réel)
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Répertoire de travail dans le conteneur
WORKDIR /siem

# ── Dépendances système (psycopg2 a besoin de libpq) ────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev \
        gcc \
    && rm -rf /var/lib/apt/lists/*

# ── Dépendances Python ───────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Code source ──────────────────────────────────────────────────────────────
COPY . .

# ── Entrypoint ───────────────────────────────────────────────────────────────
# Exécute proprement le script init_db localisé dans le sous-dossier database,
# puis garde le conteneur actif pour que tes équipiers puissent s'y connecter.
CMD ["sh", "-c", "python database/init_db.py && echo '✅ DB ready – container staying alive' && tail -f /dev/null"]