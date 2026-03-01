FROM python:3.11-slim

WORKDIR /app

# Deps système pour psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends curl gcc libpq-dev && rm -rf /var/lib/apt/lists/*

RUN pip install uv

# Copier les fichiers de dépendances
COPY backend/pyproject.toml .

# Installer les dépendances
RUN uv pip install --system -r pyproject.toml

# Copier le code
COPY backend/ .

# Exposer le port
EXPOSE 8000

# Démarrer FastAPI
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
