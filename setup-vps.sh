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
DOMAIN="${2:-_}"
APP_DIR="${3:-/opt/muxro-crm}"

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

step "Install and build backend"
cd "$APP_DIR/backend"
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
ok "Backend ready"

step "Install and build frontend"
cd "$APP_DIR/frontend"
npm ci
npm run build
ok "Frontend ready"

step "Create and start backend systemd service"
cat > /etc/systemd/system/${APP_NAME}-backend.service <<EOF
[Unit]
Description=MuxRo CRM Backend
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}/backend
Environment=NODE_ENV=production
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=/usr/bin/npm run start:prod
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${APP_NAME}-backend
systemctl restart ${APP_NAME}-backend
ok "Backend service started"

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
${DOMAIN} {
    root * ${APP_DIR}/frontend/dist
    file_server

    try_files {path} /index.html

    handle /api/* {
        reverse_proxy 127.0.0.1:${API_PORT}
    }

    handle /api/health {
        reverse_proxy 127.0.0.1:${API_PORT}
    }
}
EOF

systemctl enable caddy
systemctl restart caddy
ok "Caddy configured and running"

step "Health checks"
systemctl is-active --quiet ${APP_NAME}-backend
systemctl is-active --quiet caddy
curl -fsS "http://127.0.0.1:${API_PORT}/api/health" >/dev/null
ok "Services are healthy"

echo ""
echo "============================================================"
echo "MuxRo CRM setup completed"
echo "============================================================"
echo "URL: http://${DOMAIN}"
echo "Backend health: http://${DOMAIN}/api/health"
echo "Secrets saved at: ${SECRETS_FILE}"
echo ""
echo "Useful commands:"
echo "  systemctl status ${APP_NAME}-backend"
echo "  journalctl -u ${APP_NAME}-backend -f"
echo "  systemctl status caddy"
echo "  journalctl -u caddy -f"
echo ""
echo "SSL is automatic with Caddy. Just ensure DNS points to this server."
echo "Caddy will obtain and renew Let's Encrypt certificates automatically."
