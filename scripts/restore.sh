#!/usr/bin/env bash
# Stop the API and workers first. Restores a filename from BACKUP_DIR.
# Import legacy .sql.gz first with the backup CLI import command.
# Reads backend/.env and the process environment. Build the backend first.
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/../backend"
exec node dist/common/backup/backup.cli.js restore "$@"
