# =============================================================================
# Axiom — Backup Service Image
# =============================================================================
# Based on postgres:16-alpine so pg_dump, pg_restore and openssl are already
# present. Adds the MinIO mc client and dcron to schedule daily pg_dumps.
#
# MinIO stopped publishing the `mc` binary at dl.min.io (curl install returns
# 410 Gone) and stopped pushing new container images after 2025-10-23. The mc
# binary is pulled instead from the last image quay.io published before that
# cutoff — still a real multi-arch manifest (amd64/arm64), just frozen there.
# =============================================================================

FROM quay.io/minio/mc:RELEASE.2025-08-13T08-35-41Z AS mc

FROM postgres:16-alpine

# Install bash (for backup.sh's bash-isms), dcron, tzdata, and openssl
# (backup.sh/verify-backup.sh/rekey-backups.sh all shell out to `openssl enc`
# for AES-256 encryption — postgres:16-alpine does not bundle it by default).
RUN apk add --no-cache bash dcron tzdata openssl

# Install MinIO client (copied from the pinned quay.io/minio/mc image above)
COPY --from=mc /usr/bin/mc /usr/local/bin/mc
RUN mc --version

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Backup scripts are mounted at runtime: ./apps/api/scripts -> /scripts (read-only)
# Backup output directory:               ./backups          -> /backups

ENTRYPOINT ["/entrypoint.sh"]
