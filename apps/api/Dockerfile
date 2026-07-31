# syntax=docker/dockerfile:1.4
# Multi-stage build for Django API - optimized for fast rebuilds

# Stage 1: Base with system dependencies (cached)
FROM python:3.12-slim AS base

# Cache-buster for the OS package layer below. --cache-from reuses this layer
# across builds indefinitely (the instructions never change), so without this
# arg, `apt-get upgrade` never actually re-runs and security patches (e.g.
# Debian CVEs fixed upstream) never land in the image. CI passes a value that
# changes weekly to force a periodic refresh while keeping the layer cached
# for same-week rebuilds.
ARG APT_CACHE_BUST=1

# Install system dependencies
RUN echo "cache-bust: ${APT_CACHE_BUST}" && \
    apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    postgresql-client \
    netcat-openbsd \
    curl \
    tesseract-ocr \
    tesseract-ocr-por \
    tesseract-ocr-eng \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Stage 2: Dependencies builder (cached when requirements unchanged)
FROM base AS deps

# Cache-buster for the pip install layer below. requirements.txt only pins
# direct dependencies — transitive versions are resolved from PyPI at build
# time. --cache-from reuses this layer indefinitely while requirements.txt is
# unchanged, so a transitive package that gets a security fix upstream (e.g.
# msgpack, setuptools) never actually re-resolves and the fix never lands in
# the image. CI passes a value that changes weekly to force a periodic
# re-resolution while keeping the layer cached for same-week rebuilds.
ARG PIP_CACHE_BUST=1

# Copy requirements first (for layer caching)
COPY requirements.txt .

# Install Python dependencies with BuildKit cache mount
# Cache persists between builds, dramatically speeding up rebuilds
RUN --mount=type=cache,target=/root/.cache/pip \
    echo "cache-bust: ${PIP_CACHE_BUST}" && \
    pip install --upgrade pip && \
    pip install -r requirements.txt

# Stage 3: Production image — starts fresh to exclude build-only packages
# (build-essential brings linux-libc-dev with kernel CVEs not needed at runtime)
# Quality checks (black/isort/flake8/mypy) are NOT run here — they already run
# as dedicated, parallel CI jobs (lint:backend, typecheck:backend) before this
# image is built; re-running them inside the build would just duplicate that
# work on every single build.
FROM python:3.12-slim AS production

ARG APT_CACHE_BUST=1

RUN echo "cache-bust: ${APT_CACHE_BUST}" && \
    apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    postgresql-client \
    netcat-openbsd \
    curl \
    tesseract-ocr \
    tesseract-ocr-por \
    tesseract-ocr-eng \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed packages from deps stage
COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Create non-root user
RUN useradd -m -u 1000 appuser

# Copy application code
COPY --chown=appuser:appuser . .

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
EXPOSE 39100

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=app.settings
ENV TZ=America/Sao_Paulo

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${API_PORT:-39100}/live/ || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
