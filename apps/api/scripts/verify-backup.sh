#!/bin/bash
# =============================================================================
# Axiom Backup Verification Script
# =============================================================================
#
# Decrypts the most recent local encrypted archive, restores the plain-SQL
# dump into a temporary PostgreSQL database, validates the schema, then drops
# the temp database. Writes the result to $BACKUP_DIR/.last_verification_status.
#
# Usage:
#   /scripts/verify-backup.sh [path/to/dump.sql.gz.enc]
#
#   • If a path is given, that file is verified.
#   • If omitted, the most recent db_backup_*.sql.gz.enc in $BACKUP_DIR is used.
#
# Required environment variables (same as backup.sh):
#   PGPASSWORD            PostgreSQL password
#   BACKUP_ENCRYPTION_KEY AES-256 passphrase for the current key version.
#                         For older backups (e.g. _kv1), also set
#                         BACKUP_ENCRYPTION_KEY_v1=<old-passphrase> so this
#                         script can select the correct key automatically.
#
# Optional:
#   PGHOST, PGPORT, DB_USER, BACKUP_DIR (defaults match backup.sh)
#   MIN_TABLE_COUNT  Minimum expected tables in public schema (default: 20)
#
# Exit codes:
#   0  Verification passed
#   1  Verification failed (see output for reason)
# =============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_USER="${DB_USER:-postgres}"
PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
MIN_TABLE_COUNT="${MIN_TABLE_COUNT:-20}"
VERIFY_DB="axiom_verify_$(date +%s)"
VERIFY_STATUS_FILE="${BACKUP_DIR}/.last_verification_status"

export PGHOST PGPORT PGPASSWORD

# ── Logging ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()     { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"; }
error()   { echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $*" >&2; }
warning() { echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $*"; }

# ── Cleanup trap — always drop the temp DB and remove temp files ───────────────
TEMP_DIR=""
cleanup() {
    local exit_code=$?
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
        log "Temp files removed"
    fi
    # Drop temp database if it was created (suppress error if it doesn't exist)
    if psql \
        --host="$PGHOST" --port="$PGPORT" \
        --username="$DB_USER" \
        --dbname="postgres" \
        --no-password \
        -c "SELECT 1 FROM pg_database WHERE datname = '${VERIFY_DB}'" \
        | grep -q 1 2>/dev/null; then
        dropdb \
            --host="$PGHOST" --port="$PGPORT" \
            --username="$DB_USER" \
            --no-password \
            "$VERIFY_DB" 2>/dev/null || true
        log "Temp database '${VERIFY_DB}' dropped"
    fi
    if (( exit_code != 0 )); then
        echo "failed:$(date +%Y%m%d_%H%M%S)" > "$VERIFY_STATUS_FILE"
    fi
}
trap cleanup EXIT

# ── Fail-fast on required variables ───────────────────────────────────────────
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

log "════════════════════════════════════════════════════════════"
log "Axiom Backup Verification — $(date '+%Y-%m-%d %H:%M:%S %Z')"
log "  Target DB : ${VERIFY_DB}@${PGHOST}:${PGPORT}"
log "════════════════════════════════════════════════════════════"

# ── Step 1: Locate the backup file ────────────────────────────────────────────
if [ $# -ge 1 ] && [ -f "$1" ]; then
    ENC_FILE="$1"
else
    ENC_FILE=$(find "$BACKUP_DIR" -maxdepth 1 -name 'db_backup_*.sql.gz.enc' \
               | sort | tail -1)
fi

if [ -z "$ENC_FILE" ] || [ ! -f "$ENC_FILE" ]; then
    error "No encrypted backup found in ${BACKUP_DIR}"
    exit 1
fi

log "Step 1/5 — Verifying file: $(basename "$ENC_FILE")"
ENC_SIZE=$(du -h "$ENC_FILE" | cut -f1)
log "  File size : ${ENC_SIZE}"

# ── Resolve decryption key ─────────────────────────────────────────────────────
# Filenames include a key-version tag: db_backup_<TS>_kv<VER>.sql.gz.enc
# Try BACKUP_ENCRYPTION_KEY_<VER> first; fall back to BACKUP_ENCRYPTION_KEY.
ENC_BASENAME=$(basename "$ENC_FILE")
KEY_VERSION=""
if [[ "$ENC_BASENAME" =~ _kv([^.]+)\.sql\.gz\.enc$ ]]; then
    KEY_VERSION="${BASH_REMATCH[1]}"
fi

DECRYPT_KEY_VAR="BACKUP_ENCRYPTION_KEY"
if [ -n "$KEY_VERSION" ]; then
    VERSIONED_VAR="BACKUP_ENCRYPTION_KEY_${KEY_VERSION}"
    if [ -n "${!VERSIONED_VAR:-}" ]; then
        DECRYPT_KEY_VAR="$VERSIONED_VAR"
        log "  Key version : ${KEY_VERSION} (using ${DECRYPT_KEY_VAR})"
    else
        log "  Key version : ${KEY_VERSION} (${VERSIONED_VAR} not set, using BACKUP_ENCRYPTION_KEY)"
    fi
else
    log "  Key version : unknown (legacy filename, using BACKUP_ENCRYPTION_KEY)"
fi

export DECRYPT_KEY_FOR_VERIFY="${!DECRYPT_KEY_VAR}"
if [ -z "$DECRYPT_KEY_FOR_VERIFY" ]; then
    error "Decryption key is empty — set ${DECRYPT_KEY_VAR}"
    exit 1
fi

# ── Step 2: Decrypt + decompress ───────────────────────────────────────────────
# Use a temp *directory* + fixed filenames rather than a suffixed mktemp
# template: BusyBox's mktemp (used in the Alpine-based db-backup image)
# requires the template to end in XXXXXX with no trailing suffix, unlike
# GNU mktemp (used in the Debian-based postgres:16 image in the K8s CronJob).
TEMP_DIR=$(mktemp -d "${BACKUP_DIR}/verify_XXXXXX")
TEMP_GZ="${TEMP_DIR}/verify.sql.gz"
TEMP_SQL="${TEMP_DIR}/verify.sql"
log "Step 2/5 — Decrypting and decompressing backup..."

if ! openssl enc -d -aes-256-cbc \
    -pbkdf2 \
    -iter 600000 \
    -pass "env:DECRYPT_KEY_FOR_VERIFY" \
    -in  "$ENC_FILE" \
    -out "$TEMP_GZ"; then
    error "Decryption failed — wrong key for version '${KEY_VERSION:-unknown}' or corrupt file"
    exit 1
fi

if ! gunzip "$TEMP_GZ"; then
    error "Decompression failed — corrupt gzip archive"
    exit 1
fi

DUMP_SIZE=$(du -h "$TEMP_SQL" | cut -f1)
log "Decrypted and decompressed: ${DUMP_SIZE}"

# ── Step 3: Structural integrity ──────────────────────────────────────────────
log "Step 3/5 — Checking dump completion trailer..."

if [ ! -s "$TEMP_SQL" ] || ! tail -n 5 "$TEMP_SQL" | grep -q "PostgreSQL database dump complete"; then
    error "Dump file is empty or missing its completion trailer — archive may be corrupt/truncated"
    exit 1
fi
log "Completion trailer found"

# ── Step 4: Restore to temp database ──────────────────────────────────────────
log "Step 4/5 — Creating temp database '${VERIFY_DB}'..."

createdb \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$DB_USER" \
    --no-password \
    "$VERIFY_DB"

log "Restoring into '${VERIFY_DB}'..."

psql \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$DB_USER" \
    --dbname="$VERIFY_DB" \
    --no-password \
    --set ON_ERROR_STOP=0 \
    --file="$TEMP_SQL" \
    > /dev/null

log "Restore completed"

# ── Step 5: Schema validation ──────────────────────────────────────────────────
log "Step 5/5 — Validating schema..."

TABLE_COUNT=$(psql \
    --host="$PGHOST" --port="$PGPORT" \
    --username="$DB_USER" \
    --dbname="$VERIFY_DB" \
    --no-password \
    --tuples-only \
    -c "SELECT count(*) FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" \
    | tr -d ' ')

log "Tables in public schema: ${TABLE_COUNT}"

if (( TABLE_COUNT < MIN_TABLE_COUNT )); then
    error "Schema validation failed: found ${TABLE_COUNT} tables, expected >= ${MIN_TABLE_COUNT}"
    exit 1
fi

# Verify key Django / Axiom tables are present
REQUIRED_TABLES=(
    "django_migrations"
    "auth_user"
    "accounts_account"
    "expenses_expense"
)

for table in "${REQUIRED_TABLES[@]}"; do
    exists=$(psql \
        --host="$PGHOST" --port="$PGPORT" \
        --username="$DB_USER" \
        --dbname="$VERIFY_DB" \
        --no-password \
        --tuples-only \
        -c "SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = '${table}';" \
        | tr -d ' ')
    if [ "$exists" != "1" ]; then
        error "Required table missing from restored database: ${table}"
        exit 1
    fi
    log "  ✓ ${table}"
done

# Check migration count as a sanity measure
MIGRATION_COUNT=$(psql \
    --host="$PGHOST" --port="$PGPORT" \
    --username="$DB_USER" \
    --dbname="$VERIFY_DB" \
    --no-password \
    --tuples-only \
    -c "SELECT count(*) FROM django_migrations;" \
    | tr -d ' ')
log "Applied migrations: ${MIGRATION_COUNT}"

if (( MIGRATION_COUNT == 0 )); then
    error "django_migrations is empty — backup may be incomplete"
    exit 1
fi

# ── Write success sentinel ─────────────────────────────────────────────────────
VERIFIED_AT=$(date +%Y%m%d_%H%M%S)
echo "success:${VERIFIED_AT}:tables=${TABLE_COUNT}:migrations=${MIGRATION_COUNT}" \
    > "$VERIFY_STATUS_FILE"

log "════════════════════════════════════════════════════════════"
log "Verification PASSED at $(date '+%Y-%m-%d %H:%M:%S %Z')"
log "  Source  : $(basename "$ENC_FILE")"
log "  Tables  : ${TABLE_COUNT}"
log "  Migrations: ${MIGRATION_COUNT}"
log "════════════════════════════════════════════════════════════"
