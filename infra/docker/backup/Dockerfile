# =============================================================================
# Axiom — Backup Service Image
# =============================================================================
# Based on postgres:16-alpine so pg_dump, pg_restore and openssl are already
# present. Adds the MinIO mc client and dcron to schedule daily pg_dumps.
#
# MinIO stopped distributing binaries and removed its public images from both
# quay.io and Docker Hub (pulls fail with 401). The mc binary comes from
# pgsty/mc — Pigsty's maintained community build of the upstream source,
# multi-arch (amd64/arm64), same layout as the former official image.
# =============================================================================

FROM pgsty/mc:RELEASE.2026-09-16T00-00-00Z AS mc

FROM postgres:16-alpine

# Install bash (for backup.sh's bash-isms), dcron, tzdata, and openssl
# (backup.sh/verify-backup.sh/rekey-backups.sh all shell out to `openssl enc`
# for AES-256 encryption — postgres:16-alpine does not bundle it by default).
RUN apk add --no-cache bash dcron tzdata openssl

# Install MinIO client (copied from the pinned pgsty/mc image above)
COPY --from=mc /usr/bin/mc /usr/local/bin/mc
RUN mc --version

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Backup scripts are mounted at runtime: ./apps/api/scripts -> /scripts (read-only)
# Backup output directory:               ./backups          -> /backups

ENTRYPOINT ["/entrypoint.sh"]
