#!/bin/bash
# PostgreSQL Backup Script for MuxroUltimateCRM
# Usage: ./backup.sh [retention_days]
#
# Environment variables (set in docker-compose or .env):
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
#   BACKUP_DIR (default: /backups)

set -euo pipefail

# Configuration
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-crm_db}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${1:-${BACKUP_RETENTION_DAYS:-7}}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Starting backup of ${POSTGRES_DB}..."

# Perform backup with compression
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --format=custom \
  --compress=6 \
  --verbose \
  2>"${BACKUP_DIR}/backup_${TIMESTAMP}.log" \
  | gzip > "${BACKUP_FILE}"

# Check if backup was successful
if [ ${PIPESTATUS[0]} -eq 0 ] && [ -s "${BACKUP_FILE}" ]; then
  BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "[$(date -Iseconds)] Backup completed: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
  echo "[$(date -Iseconds)] ERROR: Backup failed!"
  exit 1
fi

# Cleanup old backups
echo "[$(date -Iseconds)] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "${POSTGRES_DB}_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
DELETED_COUNT=$(find "${BACKUP_DIR}" -name "${POSTGRES_DB}_*.sql.gz" -type f -mtime +${RETENTION_DAYS} | wc -l)

# Also cleanup old logs
find "${BACKUP_DIR}" -name "backup_*.log" -type f -mtime +${RETENTION_DAYS} -delete

# List current backups
REMAINING=$(find "${BACKUP_DIR}" -name "${POSTGRES_DB}_*.sql.gz" -type f | wc -l)
echo "[$(date -Iseconds)] ${REMAINING} backup(s) remaining"
echo "[$(date -Iseconds)] Backup process complete"
