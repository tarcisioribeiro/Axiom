#!/bin/bash
# =============================================================================
# Axiom Backup Re-encryption (Key Rotation) Script
# =============================================================================
#
# Re-encrypts existing backup files from one key version to another.
# Run this after rotating BACKUP_ENCRYPTION_KEY to ensure all stored backups
# are protected by the new key, so the old key can be safely retired.
#
# ─────────────────────────────────────────────────────────────────────────────
# Usage
# ─────────────────────────────────────────────────────────────────────────────
#   /scripts/rekey-backups.sh --from-version v1 --to-version v2 [OPTIONS]
#
#   Options:
#     --from-version VERSION   Key version suffix of existing backups (e.g. v1)
#     --to-version   VERSION   Key version suffix for re-encrypted backups (e.g. v2)
#     --upload                 Upload re-encrypted files to MinIO (default: local only)
#     --delete-old             Delete old local .enc files after successful rekey
#     --delete-old-remote      Remove old files from MinIO after successful upload
#     --dry-run                Print what would be done without making changes
#
# ─────────────────────────────────────────────────────────────────────────────
# Required Environment Variables
# ─────────────────────────────────────────────────────────────────────────────
#   BACKUP_ENCRYPTION_KEY_<FROM>  Passphrase used to encrypt the old backups
#                                 (e.g. BACKUP_ENCRYPTION_KEY_v1)
#   BACKUP_ENCRYPTION_KEY         Passphrase for the new key (current active key)
#
# Optional Environment Variables
# ─────────────────────────────────────────────────────────────────────────────
#   BACKUP_DIR      (default: /backups)
#   MINIO_ENDPOINT  Required when --upload or --delete-old-remote is set
#   MINIO_ACCESS_KEY
#   MINIO_SECRET_KEY
#   MINIO_BUCKET    (default: axiom-backups)
#   MC_BIN          (default: /usr/local/bin/mc)
#
# ─────────────────────────────────────────────────────────────────────────────
# Key Rotation Procedure
# ─────────────────────────────────────────────────────────────────────────────
#
#   1. Generate a new passphrase:
#        NEW_KEY=$(openssl rand -base64 48 | tr -d /=+ | cut -c1-40)
#
#   2. Update .env:
#        BACKUP_ENCRYPTION_KEY_v1=<old-passphrase>   # keep for rekey
#        BACKUP_ENCRYPTION_KEY=<new-passphrase>
#        BACKUP_KEY_VERSION=v2
#
#   3. Restart the db-backup container:
#        docker compose restart db-backup
#      New backups are now tagged _kv2 and encrypted with the new key.
#
#   4. Re-encrypt all existing backups (inside the db-backup container):
#        docker compose exec db-backup \
#          /scripts/rekey-backups.sh \
#            --from-version v1 \
#            --to-version v2 \
#            --upload \
#            --delete-old \
#            --delete-old-remote
#
#   5. Once re-encryption is verified, remove BACKUP_ENCRYPTION_KEY_v1 from .env.
# =============================================================================

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/backups}"
MINIO_BUCKET="${MINIO_BUCKET:-axiom-backups}"
MC_BIN="${MC_BIN:-/usr/local/bin/mc}"

FROM_VERSION=""
TO_VERSION=""
OPT_UPLOAD=false
OPT_DELETE_OLD=false
OPT_DELETE_OLD_REMOTE=false
OPT_DRY_RUN=false

# ── Argument parsing ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --from-version)    FROM_VERSION="$2";     shift 2 ;;
        --to-version)      TO_VERSION="$2";       shift 2 ;;
        --upload)          OPT_UPLOAD=true;        shift ;;
        --delete-old)      OPT_DELETE_OLD=true;    shift ;;
        --delete-old-remote) OPT_DELETE_OLD_REMOTE=true; shift ;;
        --dry-run)         OPT_DRY_RUN=true;       shift ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

# ── Validation ────────────────────────────────────────────────────────────────
if [ -z "$FROM_VERSION" ] || [ -z "$TO_VERSION" ]; then
    echo "Usage: $0 --from-version <ver> --to-version <ver> [--upload] [--delete-old] [--delete-old-remote] [--dry-run]" >&2
    exit 1
fi

if [ "$FROM_VERSION" = "$TO_VERSION" ]; then
    echo "ERROR: --from-version and --to-version must differ" >&2
    exit 1
fi

OLD_KEY_VAR="BACKUP_ENCRYPTION_KEY_${FROM_VERSION}"
if [ -z "${!OLD_KEY_VAR:-}" ]; then
    echo "ERROR: ${OLD_KEY_VAR} is not set. Export the old passphrase before running." >&2
    exit 1
fi
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY (new key) is required}"

if $OPT_UPLOAD || $OPT_DELETE_OLD_REMOTE; then
    : "${MINIO_ENDPOINT:?MINIO_ENDPOINT is required for --upload / --delete-old-remote}"
    : "${MINIO_ACCESS_KEY:?MINIO_ACCESS_KEY is required}"
    : "${MINIO_SECRET_KEY:?MINIO_SECRET_KEY is required}"
fi

# ── Logging ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()     { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"; }
error()   { echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $*" >&2; }
warning() { echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $*"; }
dryrun()  { echo -e "${YELLOW}[DRY-RUN]${NC} $*"; }

# ── MinIO setup ───────────────────────────────────────────────────────────────
if $OPT_UPLOAD || $OPT_DELETE_OLD_REMOTE; then
    "$MC_BIN" alias set axiom-minio \
        "$MINIO_ENDPOINT" \
        "$MINIO_ACCESS_KEY" \
        "$MINIO_SECRET_KEY" \
        --api S3v4 \
        > /dev/null 2>&1
fi

# ── Export keys for openssl env: references ───────────────────────────────────
export _REKEY_OLD_KEY="${!OLD_KEY_VAR}"
export _REKEY_NEW_KEY="$BACKUP_ENCRYPTION_KEY"

# ── Find files to rekey ───────────────────────────────────────────────────────
mapfile -d '' FILES < <(
    find "$BACKUP_DIR" -maxdepth 1 \
        -name "db_backup_*_kv${FROM_VERSION}.dump.enc" \
        -print0 | sort -z
)

if [ ${#FILES[@]} -eq 0 ]; then
    log "No backups with key version '${FROM_VERSION}' found in ${BACKUP_DIR}"
    exit 0
fi

log "════════════════════════════════════════════════════════════"
log "Axiom Backup Re-encryption"
log "  From key version : ${FROM_VERSION}"
log "  To   key version : ${TO_VERSION}"
log "  Files found      : ${#FILES[@]}"
log "  Upload to MinIO  : ${OPT_UPLOAD}"
log "  Delete old local : ${OPT_DELETE_OLD}"
log "  Delete old remote: ${OPT_DELETE_OLD_REMOTE}"
log "  Dry run          : ${OPT_DRY_RUN}"
log "════════════════════════════════════════════════════════════"

REKEYED=0
FAILED=0

for OLD_ENC in "${FILES[@]}"; do
    OLD_BASE=$(basename "$OLD_ENC")
    # Replace _kv<FROM> with _kv<TO> in the filename
    NEW_BASE="${OLD_BASE/_kv${FROM_VERSION}.dump.enc/_kv${TO_VERSION}.dump.enc}"
    NEW_ENC="${BACKUP_DIR}/${NEW_BASE}"
    TEMP_DUMP=$(mktemp "${BACKUP_DIR}/.rekey_XXXXXX.dump")

    log "Processing: ${OLD_BASE}"

    if $OPT_DRY_RUN; then
        dryrun "  Would decrypt  : ${OLD_BASE}"
        dryrun "  Would re-encrypt → ${NEW_BASE}"
        $OPT_UPLOAD && dryrun "  Would upload   : ${NEW_BASE} → MinIO"
        $OPT_DELETE_OLD && dryrun "  Would delete local : ${OLD_BASE}"
        $OPT_DELETE_OLD_REMOTE && dryrun "  Would delete remote: ${OLD_BASE}"
        rm -f "$TEMP_DUMP"
        (( REKEYED++ )) || true
        continue
    fi

    # Decrypt with old key
    if ! openssl enc -d -aes-256-cbc \
        -pbkdf2 -iter 600000 \
        -pass "env:_REKEY_OLD_KEY" \
        -in  "$OLD_ENC" \
        -out "$TEMP_DUMP" 2>/dev/null; then
        error "  Decryption failed: ${OLD_BASE} — skipping"
        rm -f "$TEMP_DUMP"
        (( FAILED++ )) || true
        continue
    fi

    # Re-encrypt with new key
    if ! openssl enc -aes-256-cbc \
        -pbkdf2 -iter 600000 \
        -salt \
        -pass "env:_REKEY_NEW_KEY" \
        -in  "$TEMP_DUMP" \
        -out "$NEW_ENC" 2>/dev/null; then
        error "  Re-encryption failed: ${NEW_BASE} — skipping"
        rm -f "$TEMP_DUMP" "$NEW_ENC"
        (( FAILED++ )) || true
        continue
    fi

    rm -f "$TEMP_DUMP"
    log "  Re-encrypted → ${NEW_BASE}"

    # Re-key manifest if it exists
    OLD_MANIFEST="${OLD_ENC%.dump.enc}.manifest"
    if [ -f "$OLD_MANIFEST" ]; then
        NEW_MANIFEST="${NEW_ENC%.dump.enc}.manifest"
        cp "$OLD_MANIFEST" "$NEW_MANIFEST"
        log "  Manifest copied → $(basename "$NEW_MANIFEST")"
    fi

    # Upload new file
    if $OPT_UPLOAD; then
        if "$MC_BIN" cp "$NEW_ENC" "axiom-minio/${MINIO_BUCKET}/db/" > /dev/null 2>&1; then
            log "  Uploaded to MinIO: ${NEW_BASE}"
        else
            warning "  MinIO upload failed for ${NEW_BASE} (local file retained)"
        fi
    fi

    # Delete old remote file
    if $OPT_DELETE_OLD_REMOTE; then
        if "$MC_BIN" rm "axiom-minio/${MINIO_BUCKET}/db/${OLD_BASE}" > /dev/null 2>&1; then
            log "  Deleted from MinIO: ${OLD_BASE}"
        else
            warning "  MinIO delete failed for ${OLD_BASE}"
        fi
    fi

    # Delete old local file
    if $OPT_DELETE_OLD; then
        rm -f "$OLD_ENC" "$OLD_MANIFEST"
        log "  Deleted local: ${OLD_BASE}"
    fi

    (( REKEYED++ )) || true
done

# ── Unset sensitive env vars ──────────────────────────────────────────────────
unset _REKEY_OLD_KEY _REKEY_NEW_KEY

log "════════════════════════════════════════════════════════════"
if $OPT_DRY_RUN; then
    log "Dry run complete — ${REKEYED} file(s) would be rekeyed"
else
    log "Re-encryption complete — ${REKEYED} succeeded, ${FAILED} failed"
fi
log "════════════════════════════════════════════════════════════"

[ "$FAILED" -eq 0 ]
