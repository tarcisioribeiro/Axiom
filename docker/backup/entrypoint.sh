#!/bin/bash
# =============================================================================
# Axiom Backup — Container Entrypoint
# =============================================================================
# Persists all relevant environment variables to /etc/backup-env.sh so that
# dcron (which runs in a stripped environment) can source them before each
# backup job.  Starts crond in the background and tails the backup log to
# stdout so `docker compose logs db-backup` shows backup activity.
# =============================================================================

set -euo pipefail

BACKUP_CRON="${BACKUP_CRON:-0 2 * * *}"
BACKUP_LOG="/var/log/backup.log"

# ── Persist env for cron ──────────────────────────────────────────────────────
# crond clears the environment before running jobs; write every backup-related
# variable to a file that each job sources at startup.
printenv \
  | grep -E '^(DB_|PG|BACKUP_|MINIO_|KEEP_|MC_|TZ)' \
  | sed "s/'/'\\\\''/g; s/=\(.*\)/='\1'/" \
  > /etc/backup-env.sh
# Also capture versioned historical keys (BACKUP_ENCRYPTION_KEY_v*)
# grep exits 1 when no matches — suppress that to avoid killing the script under set -e
printenv \
  | grep -E '^BACKUP_ENCRYPTION_KEY_v' \
  | sed "s/'/'\\\\''/g; s/=\(.*\)/='\1'/" \
  >> /etc/backup-env.sh || true
chmod 600 /etc/backup-env.sh

# ── Prepare log file ─────────────────────────────────────────────────────────
touch "$BACKUP_LOG"

# ── Install crontab ───────────────────────────────────────────────────────────
# Source the env file before running the backup script so all variables
# (PGPASSWORD, BACKUP_ENCRYPTION_KEY, MINIO_*, …) are available.
printf '%s . /etc/backup-env.sh && /scripts/backup.sh >> %s 2>&1\n' \
  "$BACKUP_CRON" "$BACKUP_LOG" \
  | crontab -

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Axiom backup scheduler started"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Schedule  : ${BACKUP_CRON}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Database  : ${PGHOST:-db}:${PGPORT:-5432}/${DB_NAME:-axiom_db}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Output dir: ${BACKUP_DIR:-/backups}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Retention : ${KEEP_DAILY:-7}d / ${KEEP_WEEKLY:-4}w / ${KEEP_MONTHLY:-3}m"

# ── Start crond ──────────────────────────────────────────────────────────────
crond -b -l 2 -L "$BACKUP_LOG"

# Stream backup log to stdout (keeps the container foreground and makes
# `docker compose logs db-backup` useful).
exec tail -f "$BACKUP_LOG"
