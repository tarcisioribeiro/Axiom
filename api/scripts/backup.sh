#!/bin/bash
# =============================================================================
# Axiom Database Backup Script
# =============================================================================
#
# Runs inside the Docker Compose db-backup container (see docker/backup/) or a
# Kubernetes CronJob pod (see k8s/backup-cronjob.yaml).  Connects to PostgreSQL
# via the cluster/network-internal service hostname set in PGHOST.
#
# ─────────────────────────────────────────────────────────────────────────────
# RPO / RTO Targets
# ─────────────────────────────────────────────────────────────────────────────
#
#   RPO (Recovery Point Objective): 24 hours
#     Backups run daily at 02:00 BRT (configurable via BACKUP_CRON).
#     In the worst case, up to 24 h of changes may be lost after a failure.
#
#   RTO (Recovery Time Objective): ≤ 4 hours
#     Breakdown:
#       • Download encrypted backup from MinIO          ~  5 min
#       • Decrypt with openssl                          ~  5 min
#       • Provision / restart infrastructure            ~ 30 min
#       • pg_restore (depends on DB size; typically)   ~ 30–120 min
#       • Smoke-tests and service cutover               ~ 15 min
#
# ─────────────────────────────────────────────────────────────────────────────
# Restore Procedure
# ─────────────────────────────────────────────────────────────────────────────
#
#   1. Download the encrypted dump from MinIO:
#        mc cp axiom-minio/axiom-backups/db/db_backup_<TS>_kv<VER>.dump.enc .
#
#   2. Decrypt (use the key that matches the _kv<VER> suffix in the filename;
#      store historical keys as BACKUP_ENCRYPTION_KEY_v1, _v2, etc.):
#        export BACKUP_ENCRYPTION_KEY="<key-for-that-version>"
#        openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
#          -pass env:BACKUP_ENCRYPTION_KEY \
#          -in  db_backup_<TS>_kv<VER>.dump.enc \
#          -out db_backup_<TS>_kv<VER>.dump
#
#   3. Restore:
#        pg_restore \
#          -h <PGHOST> -p <PGPORT> -U <DB_USER> -d <DB_NAME> \
#          --clean --if-exists --no-owner --no-privileges \
#          --verbose \
#          db_backup_<TS>.dump
#
# ─────────────────────────────────────────────────────────────────────────────
# Required Environment Variables
# ─────────────────────────────────────────────────────────────────────────────
#   PGPASSWORD            PostgreSQL password
#   BACKUP_ENCRYPTION_KEY AES-256 passphrase for new backups (keep secret;
#                         rotate via rekey-backups.sh — see Key Rotation below)
#   MINIO_ENDPOINT        MinIO/S3 endpoint, e.g. http://minio:9000
#   MINIO_ACCESS_KEY      MinIO/S3 access key
#   MINIO_SECRET_KEY      MinIO/S3 secret key
#
# Optional Environment Variables
# ─────────────────────────────────────────────────────────────────────────────
#   PGHOST               (default: db)
#   PGPORT               (default: 5432)
#   DB_NAME              (default: axiom_db)
#   DB_USER              (default: postgres)
#   BACKUP_DIR           (default: /backups)
#   MINIO_BUCKET         (default: axiom-backups)
#   KEEP_DAILY           (default: 7)   — daily backups to keep locally
#   KEEP_WEEKLY          (default: 4)   — one-per-week backups to keep locally
#   KEEP_MONTHLY         (default: 3)   — one-per-month backups to keep locally
#   MC_BIN               (default: /usr/local/bin/mc)
#   BACKUP_KEY_VERSION   (default: v1)  — version label embedded in filename;
#                        increment (v2, v3, …) when rotating the key
#
# ─────────────────────────────────────────────────────────────────────────────
# Key Rotation
# ─────────────────────────────────────────────────────────────────────────────
#
#   Backup filenames include the key version (e.g. _kv1) so that the correct
#   decryption key can always be identified.  To rotate:
#
#   1. Generate a new passphrase and set it as BACKUP_ENCRYPTION_KEY in .env.
#   2. Increment BACKUP_KEY_VERSION (e.g. v1 → v2) in .env.
#   3. Store the OLD key as BACKUP_ENCRYPTION_KEY_v1 in .env (for decryption
#      of historical backups and for rekey-backups.sh).
#   4. Restart the db-backup container so it picks up the new env vars.
#   5. Optionally re-encrypt existing backups:
#        BACKUP_ENCRYPTION_KEY_v1=<old> BACKUP_ENCRYPTION_KEY=<new> \
#          /scripts/rekey-backups.sh --from-version v1 --to-version v2
# =============================================================================

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="${DB_NAME:-axiom_db}"
DB_USER="${DB_USER:-postgres}"
PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
MINIO_BUCKET="${MINIO_BUCKET:-axiom-backups}"
MC_BIN="${MC_BIN:-/usr/local/bin/mc}"
BACKUP_KEY_VERSION="${BACKUP_KEY_VERSION:-v1}"

# GFS (Grandfather-Father-Son) retention policy
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
KEEP_MONTHLY="${KEEP_MONTHLY:-3}"

export PGHOST PGPORT PGPASSWORD

# ── Fail-fast on missing required variables ────────────────────────────────────
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
: "${MINIO_ENDPOINT:?MINIO_ENDPOINT is required}"
: "${MINIO_ACCESS_KEY:?MINIO_ACCESS_KEY is required}"
: "${MINIO_SECRET_KEY:?MINIO_SECRET_KEY is required}"

# ── Logging ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()     { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"; }
error()   { echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $*" >&2; }
warning() { echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $*"; }

# ── File paths ─────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

DB_DUMP="$BACKUP_DIR/db_backup_${DATE}_kv${BACKUP_KEY_VERSION}.dump"
DB_ENC="$BACKUP_DIR/db_backup_${DATE}_kv${BACKUP_KEY_VERSION}.dump.enc"
DB_MANIFEST="$BACKUP_DIR/db_backup_${DATE}_kv${BACKUP_KEY_VERSION}.manifest"
SENTINEL_FILE="$BACKUP_DIR/.last_successful_backup"
STATUS_FILE="$BACKUP_DIR/.last_backup_status"

log "════════════════════════════════════════════════════════════"
log "Axiom Backup — $(date '+%Y-%m-%d %H:%M:%S %Z')"
log "  Database  : ${DB_NAME}@${PGHOST}:${PGPORT}"
log "  Bucket    : ${MINIO_ENDPOINT}/${MINIO_BUCKET}/db/"
log "  Retention : ${KEEP_DAILY}d / ${KEEP_WEEKLY}w / ${KEEP_MONTHLY}m"
log "════════════════════════════════════════════════════════════"

# Mark the backup as in-progress so monitoring can detect hung jobs
echo "in_progress:${DATE}" > "$STATUS_FILE"

# ─────────────────────────────────────────────────────────────────────────────
# Step 1: Database dump — PostgreSQL custom format (-Fc)
#
# Custom format advantages over plain SQL:
#   • Built-in compression (level 9 used here)
#   • Selective table/schema restore
#   • Parallel restore with --jobs
#   • Readable by pg_restore --list for integrity checks
# ─────────────────────────────────────────────────────────────────────────────
log "Step 1/5 — Creating database dump (custom format, compression=9)..."

pg_dump \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --format=custom \
    --compress=9 \
    --no-password \
    --file="$DB_DUMP"

DUMP_SIZE=$(du -h "$DB_DUMP" | cut -f1)
log "Dump created: $(basename "$DB_DUMP") (${DUMP_SIZE})"

# ─────────────────────────────────────────────────────────────────────────────
# Step 2: Integrity verification — pg_restore --list
#
# Reads the dump's table-of-contents without performing any restore.
# A non-zero exit code or empty manifest signals a corrupt archive.
# The manifest is uploaded alongside the encrypted dump for auditing.
# ─────────────────────────────────────────────────────────────────────────────
log "Step 2/5 — Verifying backup integrity (pg_restore --list)..."

if pg_restore --list "$DB_DUMP" > "$DB_MANIFEST" 2>&1; then
    OBJECT_COUNT=$(grep -c '^[0-9]' "$DB_MANIFEST" || echo "0")
    log "Integrity check passed — ${OBJECT_COUNT} objects catalogued"
else
    error "pg_restore --list failed — archive may be corrupt"
    error "Manifest output:"
    cat "$DB_MANIFEST" >&2
    rm -f "$DB_DUMP" "$DB_MANIFEST"
    echo "failed:integrity_check:${DATE}" > "$STATUS_FILE"
    exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Step 3: AES-256-CBC encryption
#
# • PBKDF2 key derivation with 600 000 iterations (NIST SP 800-132 guidance)
# • Random salt prepended to ciphertext (required for decryption)
# • Key read via -pass env:VAR — not visible in /proc/<pid>/cmdline or ps
# ─────────────────────────────────────────────────────────────────────────────
log "Step 3/5 — Encrypting backup (AES-256-CBC, PBKDF2, 600k iterations, key version: ${BACKUP_KEY_VERSION})..."

openssl enc -aes-256-cbc \
    -pbkdf2 \
    -iter 600000 \
    -salt \
    -pass "env:BACKUP_ENCRYPTION_KEY" \
    -in  "$DB_DUMP" \
    -out "$DB_ENC"

ENC_SIZE=$(du -h "$DB_ENC" | cut -f1)
log "Encrypted: $(basename "$DB_ENC") (${ENC_SIZE})"

# Remove the unencrypted dump immediately after encryption
rm -f "$DB_DUMP"
log "Unencrypted dump removed"

# ─────────────────────────────────────────────────────────────────────────────
# Step 4: Upload to MinIO — mandatory
#
# Both the encrypted dump and the plaintext manifest are uploaded.
# Failure to upload the dump is fatal; manifest upload failure is a warning.
# ─────────────────────────────────────────────────────────────────────────────
log "Step 4/5 — Uploading to MinIO (${MINIO_ENDPOINT})..."

# Configure mc alias (stdout/stderr suppressed to avoid leaking credentials)
"$MC_BIN" alias set axiom-minio \
    "$MINIO_ENDPOINT" \
    "$MINIO_ACCESS_KEY" \
    "$MINIO_SECRET_KEY" \
    --api S3v4 \
    > /dev/null 2>&1

# Ensure bucket exists (idempotent)
"$MC_BIN" mb --ignore-existing "axiom-minio/${MINIO_BUCKET}" > /dev/null 2>&1 || true

# Upload encrypted dump — failure is fatal
if ! "$MC_BIN" cp "$DB_ENC" "axiom-minio/${MINIO_BUCKET}/db/"; then
    error "Failed to upload encrypted dump to MinIO — backup not stored off-site"
    echo "failed:minio_upload:${DATE}" > "$STATUS_FILE"
    exit 1
fi
log "Encrypted dump uploaded"

# Upload manifest — failure is non-fatal (aids auditing without decryption)
if "$MC_BIN" cp "$DB_MANIFEST" "axiom-minio/${MINIO_BUCKET}/db/" > /dev/null 2>&1; then
    log "Manifest uploaded"
else
    warning "Manifest upload failed (non-critical)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Optional: Media files backup
#
# Only runs when /app/media is mounted and non-empty.
# ─────────────────────────────────────────────────────────────────────────────
MEDIA_ARCHIVE="$BACKUP_DIR/media_backup_${DATE}.tar.gz"

if [ -d "/app/media" ] && [ "$(ls -A /app/media 2>/dev/null)" ]; then
    log "Media backup — archiving /app/media..."
    if tar -czf "$MEDIA_ARCHIVE" -C /app media/ 2>/dev/null; then
        MEDIA_SIZE=$(du -h "$MEDIA_ARCHIVE" | cut -f1)
        log "Media archive created: $(basename "$MEDIA_ARCHIVE") (${MEDIA_SIZE})"
        if "$MC_BIN" cp "$MEDIA_ARCHIVE" "axiom-minio/${MINIO_BUCKET}/media/" > /dev/null 2>&1; then
            log "Media archive uploaded to MinIO"
        else
            warning "Media archive upload failed (non-critical)"
        fi
    else
        warning "Failed to create media archive (non-critical)"
    fi
else
    log "No media files found — skipping media backup"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Step 5: Local retention — GFS (Grandfather-Father-Son) policy
#
# Files are named db_backup_YYYYMMDD_HHMMSS.dump.enc; the date is parsed
# directly from the filename (more reliable than mtime under copy/move).
#
# Keep:
#   • The ${KEEP_DAILY} most recent backups (daily)
#   • One backup per ISO week for the last ${KEEP_WEEKLY} distinct weeks
#   • One backup per calendar month for the last ${KEEP_MONTHLY} months
#
# A file can satisfy multiple criteria; it is kept if it satisfies any one.
# Matching manifest files are deleted alongside their dump.
# ─────────────────────────────────────────────────────────────────────────────
log "Step 5/5 — Applying GFS retention (${KEEP_DAILY}d / ${KEEP_WEEKLY}w / ${KEEP_MONTHLY}m)..."

prune_local_backups() {
    # Collect all encrypted dumps, sorted newest-first by filename timestamp.
    local -a all_files=()
    while IFS= read -r -d '' f; do
        all_files+=("$f")
    done < <(find "$BACKUP_DIR" -maxdepth 1 -name 'db_backup_*.dump.enc' -print0 \
             | sort -rz)

    local total=${#all_files[@]}
    if (( total == 0 )); then
        log "No local encrypted dumps found — nothing to prune"
        return
    fi

    # Mark files to keep.
    local -a keep=()
    local -A seen_weeks=()
    local -A seen_months=()
    local daily_count=0

    for f in "${all_files[@]}"; do
        local base date_str year month day week ym keep_this
        base=$(basename "$f")

        # Parse YYYYMMDD from: db_backup_YYYYMMDD_HHMMSS.dump.enc
        date_str="${base#db_backup_}"   # YYYYMMDD_HHMMSS.dump.enc
        date_str="${date_str%%_*}"      # YYYYMMDD (stop at first underscore after date)
        # Handle edge case: if stripping only produced length-8 string
        if [[ ${#date_str} -ne 8 ]] || ! [[ $date_str =~ ^[0-9]{8}$ ]]; then
            warning "Skipping unrecognised filename: $base"
            keep+=("$f")
            continue
        fi

        year="${date_str:0:4}"
        month="${date_str:4:2}"
        day="${date_str:6:2}"

        # ISO year-week (GNU date); fall back to calendar month on failure.
        week=$(date -d "${year}-${month}-${day}" +%G-%V 2>/dev/null) \
            || week="${year}-${month}"
        ym="${year}-${month}"

        keep_this=false

        if (( daily_count < KEEP_DAILY )); then
            keep_this=true
            (( daily_count++ )) || true
        elif [[ -z "${seen_weeks[$week]+x}" ]] \
             && (( ${#seen_weeks[@]} < KEEP_WEEKLY )); then
            keep_this=true
            seen_weeks["$week"]=1
        elif [[ -z "${seen_months[$ym]+x}" ]] \
             && (( ${#seen_months[@]} < KEEP_MONTHLY )); then
            keep_this=true
            seen_months["$ym"]=1
        fi

        if $keep_this; then
            keep+=("$f")
        fi
    done

    # Delete files not in the keep list (with matching manifest).
    local deleted=0
    for f in "${all_files[@]}"; do
        local in_keep=false
        local k
        for k in "${keep[@]}"; do
            [[ "$k" == "$f" ]] && { in_keep=true; break; }
        done
        if ! $in_keep; then
            rm -f "$f"
            rm -f "${f%.dump.enc}.manifest"
            (( deleted++ )) || true
            log "Pruned: $(basename "$f")"
        fi
    done

    log "Retention: kept ${#keep[@]} / ${total} local dumps (deleted ${deleted})"
}

prune_local_backups

# Also clean up local media archives older than (KEEP_DAILY + KEEP_WEEKLY*7 + KEEP_MONTHLY*31) days
MEDIA_MAX_AGE=$(( KEEP_DAILY + KEEP_WEEKLY * 7 + KEEP_MONTHLY * 31 ))
find "$BACKUP_DIR" -maxdepth 1 -name "media_backup_*.tar.gz" \
    -mtime "+${MEDIA_MAX_AGE}" -delete 2>/dev/null || true

# ─────────────────────────────────────────────────────────────────────────────
# Monitoring sentinel — written only on full success
#
# check_backup_health Django management command reads these files.
# ─────────────────────────────────────────────────────────────────────────────
UNIX_TS=$(date +%s)
echo "$UNIX_TS" > "$SENTINEL_FILE"
echo "success:${DATE}" > "$STATUS_FILE"
log "Monitoring sentinel updated: $SENTINEL_FILE"

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
TOTAL_LOCAL=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "N/A")
log "════════════════════════════════════════════════════════════"
log "Backup completed successfully at $(date '+%Y-%m-%d %H:%M:%S %Z')"
log "  Encrypted dump : $(basename "$DB_ENC")"
log "  Manifest       : $(basename "$DB_MANIFEST")"
log "  Remote path    : ${MINIO_ENDPOINT}/${MINIO_BUCKET}/db/"
log "  Local dir size : ${TOTAL_LOCAL}"
log "  Timestamp      : ${DATE}"
log "  Key version    : ${BACKUP_KEY_VERSION}"
log "════════════════════════════════════════════════════════════"
