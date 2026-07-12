#!/bin/bash
# PostgreSQL Restore Script for MuxroUltimateCRM
# Usage: ./restore.sh <backup_file.sql.gz>
#
# WARNING: This will DROP and recreate the database!
#
# Environment variables (set in docker-compose or .env):
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB

set -euo pipefail

# Configuration
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-crm_db}"
BACKUP_FILE="${1:-}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  find "${BACKUP_DIR:-/backups}" -name "${POSTGRES_DB}_*.sql.gz" -type f -printf "%T@ %Tc %f (%s)\n" 2>/dev/null | sort -rn | head -10
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "WARNING: This will DROP and recreate the database '${POSTGRES_DB}'!"
echo "Backup file: ${BACKUP_FILE}"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo "[$(date -Iseconds)] Starting restore from ${BACKUP_FILE}..."

# Stop existing connections
echo "[$(date -Iseconds)] Terminating existing connections..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" \
  2>/dev/null || true

# Drop and recreate database
echo "[$(date -Iseconds)] Dropping and recreating database..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d postgres \
  -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};" \
  -c "CREATE DATABASE ${POSTGRES_DB};" \
  2>/dev/null

# Restore from backup
echo "[$(date -Iseconds)] Restoring data..."
gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --verbose \
  --no-owner \
  --no-privileges \
  2>"${BACKUP_DIR}/restore_$(date +%Y%m%d_%H%M%S).log" || true

# Verify restore
echo "[$(date -Iseconds)] Verifying restore..."
TABLE_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" \
  2>/dev/null | tr -d ' ')

echo "[$(date -Iseconds)] Restore complete. ${TABLE_COUNT} tables found."
echo "[$(date -Iseconds)] You may need to run 'npm run db:push' if there are pending schema changes."
