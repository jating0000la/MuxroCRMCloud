#!/usr/bin/env bash
# Uses the same validated archives, retention and operation lock as the API.
# Reads backend/.env and the process environment. Build the backend first.
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/../backend"
exec node dist/common/backup/backup.cli.js create "$@"
