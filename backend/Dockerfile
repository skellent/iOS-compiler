# syntax=docker/dockerfile:1
# Build context is the repository root (see docker-compose.yml / the -f note in
# the docs), because the backend serves the mobile app's built UI from ../app/www.

# ---- builder: resolve and install dependencies into a venv ----
FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# The `mariadb` connector is compiled against the MariaDB Connector/C headers.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libmariadb-dev \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /build
COPY backend/pyproject.toml ./
RUN uv sync --no-dev --no-install-project

# ---- runtime: slim image with the shared library, the backend, and app/www ----
FROM python:3.12-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
        libmariadb3 \
        curl \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Mirror the repo layout so app_assets.APP_WWW_DIR (../../../app/www) resolves.
WORKDIR /srv/backend
COPY --from=builder /opt/venv /opt/venv
COPY backend/ /srv/backend/
COPY app/www/ /srv/app/www/

RUN useradd --create-home --uid 1000 app && chown -R app:app /srv
USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
