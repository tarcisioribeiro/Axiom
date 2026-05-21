# =============================================================================
# Axiom — Backup Service Image
# =============================================================================
# Based on postgres:16-alpine so pg_dump, pg_restore and openssl are already
# present. Adds the MinIO mc client and dcron to schedule daily pg_dumps.
#
# Build args:
#   TARGETARCH   Set automatically by buildx (amd64 | arm64). Override only
#                when building without buildx on a non-amd64 host.
# =============================================================================

FROM postgres:16-alpine

ARG TARGETARCH=amd64

# Install bash (for backup.sh's bash-isms), dcron, curl, and tzdata
RUN apk add --no-cache bash dcron curl tzdata

# Install MinIO client — architecture-aware
RUN curl -fsSL \
    "https://dl.min.io/client/mc/release/linux-${TARGETARCH}/mc" \
    -o /usr/local/bin/mc \
  && chmod +x /usr/local/bin/mc \
  && mc --version

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Backup scripts are mounted at runtime: ./api/scripts -> /scripts (read-only)
# Backup output directory:               ./backups     -> /backups

ENTRYPOINT ["/entrypoint.sh"]
