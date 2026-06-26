# ── Stage : runtime ────────────────────────────────────────────────────────
FROM python:3.11-slim

# Métadonnées
LABEL maintainer="Smart SIEM Team"
LABEL description="Service d'initialisation PostgreSQL pour le Smart SIEM CTU"

# Empêche Python de bufferiser stdout/stderr (logs visibles en temps réel)
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Répertoire de travail
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
# Lance le script d'initialisation, puis garde le conteneur actif (ou enchaîne
# avec votre serveur applicatif en remplaçant la commande tail).
CMD ["sh", "-c", "python -m database.init_db && echo '✅ DB ready – container staying alive' && tail -f /dev/null"]
