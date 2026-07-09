#!/usr/bin/env bash

################################################################################
# MuxRo Ultimate CRM - 5 Minute VPS Setup (No Docker)
# Target: Fresh Ubuntu/Debian VPS
#
# Usage:
#   sudo bash setup-vps.sh [repo_url] [domain] [app_dir]
#
# Example:
#   sudo bash setup-vps.sh \
#     https://github.com/jating0000la/MuxroCRMCloud.git \
#     crm.example.com \
#     /opt/muxro-crm
################################################################################

set -euo pipefail

REPO_URL="${1:-https://github.com/jating0000la/MuxroCRMCloud.git}"
DOMAIN="${2:-muxrocrm.com}"
APP_DIR="${3:-/root/MuxroCRMCloud}"

APP_NAME="muxro-crm"
API_PORT="3000"
DB_NAME="crm_db"
DB_USER="crm_user"
DB_PASS="${DB_PASS:-$(openssl rand -hex 16)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 48 | tr -d '\n')}"
APP_ENCRYPTION_KEY="${APP_ENCRYPTION_KEY:-$(openssl rand -base64 32 | tr -d '\n')}"
ENCRYPTION_SALT="${ENCRYPTION_SALT:-$(openssl rand -hex 16)}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[ERROR] Run as root or with sudo."
  exit 1
fi

if [[ ! -f /etc/debian_version ]]; then
  echo "[ERROR] This script supports Debian/Ubuntu only."
  exit 1
fi

STEP=1
TOTAL_STEPS=11

step() {
  echo ""
  echo "============================================================"
  echo "[$STEP/$TOTAL_STEPS] $1"
  echo "============================================================"
  STEP=$((STEP + 1))
}

ok() {
  echo "[OK] $1"
}

info() {
  echo "[INFO] $1"
}

step "Install base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
  ca-certificates \
  curl \
  git \
  gnupg \
  lsb-release \
  build-essential \
  postgresql \
  postgresql-contrib
ok "Base packages installed"

step "Install Node.js (20.x if missing or too old)"
NODE_MAJOR="0"
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -v | sed 's/v//' | cut -d'.' -f1)"
fi

if [[ "$NODE_MAJOR" -lt 18 ]]; then
  info "Installing Node.js 20.x"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

node -v
npm -v
npm install -g pm2
ok "Node.js and npm ready"

step "Clone or update repository"
if [[ -d "$APP_DIR/.git" ]]; then
  info "Repository exists. Pulling latest changes"
  git -C "$APP_DIR" pull --ff-only || true
else
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi
ok "Repository ready at $APP_DIR"

step "Start and enable PostgreSQL"
systemctl enable postgresql
systemctl start postgresql
ok "PostgreSQL is running"

step "Create database and user"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
ok "Database configured"

step "Repair database schema ownership for Prisma migrations"
sudo -u postgres psql -d "${DB_NAME}" <<PSQL_EOF
ALTER SCHEMA public OWNER TO ${DB_USER};
GRANT USAGE ON SCHEMA public TO ${DB_USER};
GRANT USAGE, CREATE ON SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};

DO \$\$
BEGIN
  -- Grant on all existing tables
  EXECUTE (SELECT 'GRANT ALL PRIVILEGES ON TABLE ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' TO "${DB_USER}"' FROM pg_tables WHERE schemaname = 'public');
  -- Grant on all existing sequences
  EXECUTE (SELECT 'GRANT ALL PRIVILEGES ON SEQUENCE ' || string_agg(format('%I.%I', sequence_schema, sequence_name), ', ') || ' TO "${DB_USER}"' FROM information_schema.sequences WHERE sequence_schema = 'public');
END \$\$;
PSQL_EOF
ok "Database schema ownership repaired"

step "Create production environment files"
cat > "$APP_DIR/.env" <<EOF
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=${DB_NAME}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRATION=7d
APP_ENCRYPTION_KEY=${APP_ENCRYPTION_KEY}
ENCRYPTION_SALT=${ENCRYPTION_SALT}
NODE_ENV=production
PORT=${API_PORT}
CORS_ORIGIN=http://${DOMAIN}
SWAGGER_ENABLED=false
PUBLIC_FORMS_ENABLED=true
EOF

cat > "$APP_DIR/backend/.env" <<EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRATION=7d
APP_ENCRYPTION_KEY=${APP_ENCRYPTION_KEY}
ENCRYPTION_SALT=${ENCRYPTION_SALT}
PORT=${API_PORT}
NODE_ENV=production
CORS_ORIGIN=http://${DOMAIN}
SWAGGER_ENABLED=false
PUBLIC_FORMS_ENABLED=true
EOF

# Prefer HTTPS origin in production domain setups
if [[ "$DOMAIN" != "_" ]]; then
  sed -i "s#CORS_ORIGIN=http://${DOMAIN}#CORS_ORIGIN=https://${DOMAIN}#g" "$APP_DIR/.env" "$APP_DIR/backend/.env"
fi

SECRETS_FILE="$APP_DIR/DEPLOYMENT_SECRETS.txt"
cat > "$SECRETS_FILE" <<EOF
APP_DIR=${APP_DIR}
DOMAIN=${DOMAIN}
DATABASE_NAME=${DB_NAME}
DATABASE_USER=${DB_USER}
DATABASE_PASSWORD=${DB_PASS}
JWT_SECRET=${JWT_SECRET}
APP_ENCRYPTION_KEY=${APP_ENCRYPTION_KEY}
ENCRYPTION_SALT=${ENCRYPTION_SALT}
EOF
chmod 600 "$SECRETS_FILE"
ok "Environment files created"

step "Verify database connectivity before build"
echo "[INFO] Testing database connection with credentials..."
DB_CONN_TEST=$(PGPASSWORD="${DB_PASS}" psql -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" 2>&1 || true)
if echo "$DB_CONN_TEST" | grep -q "^\s*1\s*$"; then
  echo "[OK] Database connection successful"
else
  echo "[WARN] Initial connection test failed. PostgreSQL may need more time to start."
  echo "[INFO] Waiting 5 seconds and retrying..."
  sleep 5
  if ! PGPASSWORD="${DB_PASS}" psql -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" >/dev/null 2>&1; then
    echo "❌ Database connection failed after retry"
    echo "[DEBUG] Credentials: user=${DB_USER}, db=${DB_NAME}, host=127.0.0.1"
    exit 1
  fi
  echo "[OK] Database connection successful after retry"
fi

step "Install and build backend"
cd "$APP_DIR/backend"
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public"
echo "[INFO] Installing dependencies with npm ci..."
npm ci --prefer-offline --no-audit 2>&1 | tail -20 || { echo "❌ npm ci failed"; exit 1; }
echo "[INFO] Waiting 2 seconds for PostgreSQL to stabilize..."
sleep 2
echo "[INFO] Generating Prisma client..."
if npx prisma generate 2>&1; then
  echo "[OK] Prisma client generated"
else
  echo "❌ Prisma generate failed"
  exit 1
fi
echo "[INFO] Running Prisma migrations..."
if npx prisma migrate deploy 2>&1; then
  echo "[OK] Prisma migrations completed"
else
  echo "❌ Prisma migrate failed"
  echo "[DEBUG] Check database permissions with: sudo -u postgres psql -d ${DB_NAME} -c '\\dt'"
  exit 1
fi
echo "[INFO] Building NestJS application..."
npm run build 2>&1 || { echo "❌ Build failed"; exit 1; }
if [ ! -f dist/main.js ]; then
  echo "❌ dist/main.js not found after build"
  exit 1
fi
echo "[OK] Backend build successful"
ok "Backend ready"

step "Install and build frontend"
cd "$APP_DIR/frontend"
npm ci
npm run build
ok "Frontend ready"

step "Create and start backend PM2 service"
cd "$APP_DIR/backend"
pm2 delete ${APP_NAME}-backend >/dev/null 2>&1 || true
pm2 start npm --name ${APP_NAME}-backend --cwd "$APP_DIR/backend" -- run start:prod
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
ok "Backend PM2 process started"

step "Install Caddy"
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi
ok "Caddy installed"

step "Configure Caddy for frontend + API proxy"
cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN}, www.${DOMAIN} {
  @www host www.${DOMAIN}
  redir @www https://${DOMAIN}{uri} 308

  encode zstd gzip
  root * ${APP_DIR}/frontend/dist

  @api path /api/*
  handle @api {
    reverse_proxy 127.0.0.1:${API_PORT} {
      header_up X-Real-IP {remote_host}
      header_up X-Forwarded-For {remote_host}
      header_up X-Forwarded-Proto {scheme}
    }
  }

  @immutableAssets path_regexp staticAssets \
    .*\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|map)$
  header @immutableAssets Cache-Control "public, max-age=31536000, immutable"

  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "SAMEORIGIN"
    Referrer-Policy "strict-origin-when-cross-origin"
  }

  try_files {path} /index.html
  file_server

  log {
    output file /var/log/caddy/muxrocrm.access.log {
      roll_size 20MiB
      roll_keep 10
      roll_keep_for 720h
    }
    format json
  }
}
EOF

systemctl enable caddy
systemctl restart caddy
ok "Caddy configured and running"

step "Health checks"
echo "[INFO] Waiting 5 seconds for PM2 process to start..."
sleep 5
if pm2 describe ${APP_NAME}-backend >/dev/null 2>&1; then
  echo "[OK] PM2 process is running"
else
  echo "[WARN] PM2 process might not be fully started yet"
fi
if systemctl is-active --quiet caddy; then
  echo "[OK] Caddy service is active"
else
  echo "[ERROR] Caddy service is not active"
fi
echo "[INFO] Waiting 3 more seconds for backend to boot..."
sleep 3
if curl -fsS "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1; then
  echo "[OK] Backend is responding to health checks"
else
  echo "[WARN] Backend health check not responding yet. May still be initializing."
fi
if [[ "$DOMAIN" != "_" ]]; then
  sleep 2
  if curl -fsS "https://${DOMAIN}/api/health" >/dev/null 2>&1; then
    echo "[OK] Public HTTPS API is working"
  else
    echo "[WARN] Public HTTPS API not yet accessible. DNS may need propagation."
  fi
fi
ok "Health checks complete"

echo ""
echo "============================================================"
echo "MuxRo CRM setup completed"
echo "============================================================"
echo "URL: https://${DOMAIN}"
echo "Backend health: https://${DOMAIN}/api/health"
echo "Secrets saved at: ${SECRETS_FILE}"
echo ""
echo "Useful commands:"
echo "  pm2 status"
echo "  pm2 logs ${APP_NAME}-backend"
echo "  pm2 restart ${APP_NAME}-backend"
echo "  systemctl status caddy"
echo "  journalctl -u caddy -f"
echo ""
echo "SSL is automatic with Caddy. Just ensure DNS points to this server."
echo "Caddy will obtain and renew Let's Encrypt certificates automatically."
