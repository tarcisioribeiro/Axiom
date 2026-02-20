# syntax=docker/dockerfile:1.4
# Multi-stage build for Django API - optimized for fast rebuilds

# Stage 1: Base with system dependencies (cached)
FROM python:3.12-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    postgresql-client \
    netcat-openbsd \
    curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Stage 2: Dependencies builder (cached when requirements unchanged)
FROM base AS deps

# Copy requirements first (for layer caching)
COPY requirements.txt .

# Install Python dependencies with BuildKit cache mount
# Cache persists between builds, dramatically speeding up rebuilds
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install -r requirements.txt

# Stage 3: Dev dependencies (for quality checks)
FROM deps AS dev-deps

COPY requirements-dev.txt .

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements-dev.txt

# Stage 4: Quality checks (runs black, isort, flake8 — fails fast before production build)
FROM dev-deps AS quality

WORKDIR /app

COPY . .

RUN black --check . && isort --check . && flake8 .

# Stage 5: Production image
FROM base AS production

WORKDIR /app

# Copy installed packages from deps stage
COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Create non-root user
RUN useradd -m -u 1000 appuser

# Copy application code from quality stage (ensures checks have passed)
COPY --from=quality --chown=appuser:appuser /app .

# Create required directories with correct permissions (after COPY to ensure proper ownership)
RUN mkdir -p /app/media/security/archives /app/media/loans /app/logs /app/staticfiles && \
    chown -R appuser:appuser /app && \
    chmod +x /app/entrypoint.sh && \
    chmod -R 755 /app/media

# Create media fix script that can be run if needed
RUN echo '#!/bin/bash\nmkdir -p /app/media/security/archives/$(date +%Y)/$(date +%m) /app/media/loans 2>/dev/null || true' > /app/fix-media-permissions.sh && \
    chmod +x /app/fix-media-permissions.sh

# Switch to non-root user
USER appuser

# Expose API port
EXPOSE 8002

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=app.settings
ENV TZ=America/Sao_Paulo

ENTRYPOINT ["/app/entrypoint.sh"]
