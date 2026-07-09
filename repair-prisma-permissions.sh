#!/usr/bin/env bash

set -euo pipefail

DB_NAME="${1:-crm_db}"
DB_USER="${2:-crm_user}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[ERROR] Run as root or with sudo."
  exit 1
fi

if [[ ! -f /etc/debian_version ]]; then
  echo "[ERROR] This script supports Debian/Ubuntu only."
  exit 1
fi

echo "Repairing PostgreSQL permissions for database: ${DB_NAME}"
echo "Target user: ${DB_USER}"

sudo -u postgres psql -d "${DB_NAME}" <<EOF
ALTER SCHEMA public OWNER TO ${DB_USER};
GRANT USAGE, CREATE ON SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
DO \$\$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO %I', r.tablename, '${DB_USER}');
    EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO %I', r.tablename, '${DB_USER}');
  END LOOP;

  FOR r IN
    SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO %I', r.sequence_name, '${DB_USER}');
    EXECUTE format('GRANT ALL PRIVILEGES ON SEQUENCE public.%I TO %I', r.sequence_name, '${DB_USER}');
  END LOOP;
END \$\$;
EOF

echo "Permissions repaired. Re-run migrations with your normal app user next."
