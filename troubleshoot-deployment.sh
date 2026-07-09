#!/usr/bin/env bash

################################################################################
# MuxRo CRM - Deployment Troubleshooting & Recovery Guide
# Handles common errors: Database, Prisma, Build, PM2, Caddy
################################################################################

set -e

APP_DIR="${1:-/root/MuxroCRMCloud}"
DB_NAME="${2:-crm_db}"
DB_USER="${3:-crm_user}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

error() { echo -e "${RED}❌ ERROR${NC}: $1"; }
success() { echo -e "${GREEN}✅ SUCCESS${NC}: $1"; }
warn() { echo -e "${YELLOW}⚠️  WARNING${NC}: $1"; }
info() { echo -e "${BLUE}ℹ️  INFO${NC}: $1"; }

echo "════════════════════════════════════════════════════════════"
echo "  MuxRo CRM - Deployment Troubleshooting & Recovery"
echo "════════════════════════════════════════════════════════════"
echo ""

# ISSUE 1: Prisma connection error during npm install/build
echo ""
echo "────────────────────────────────────────────────────────────"
echo "ISSUE 1: Prisma Cannot Connect to Database"
echo "────────────────────────────────────────────────────────────"
echo ""
info "Error Message:"
echo '  "Please make sure to provide valid database credentials for'
echo '   the database server at `127.0.0.1`"'
echo ""
echo "Fixes to try in order:"
echo ""

echo "1️⃣  Check if PostgreSQL is running:"
sudo systemctl status postgresql || true
if ! systemctl is-active --quiet postgresql; then
  warn "PostgreSQL is not running!"
  info "Starting PostgreSQL..."
  sudo systemctl start postgresql
  success "PostgreSQL started"
fi

echo ""
echo "2️⃣  Verify DATABASE_URL is set correctly:"
if [ -f "$APP_DIR/backend/.env" ]; then
  DB_URL=$(grep "^DATABASE_URL=" "$APP_DIR/backend/.env" || echo "NOT SET")
  info "Current DATABASE_URL: ${DB_URL:0:60}..."
else
  error "Backend .env not found at $APP_DIR/backend/.env"
fi

echo ""
echo "3️⃣  Check if database and user exist:"
sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datname='${DB_NAME}'" || error "Database check failed"
sudo -u postgres psql -tAc "SELECT usename FROM pg_user WHERE usename='${DB_USER}'" || error "User check failed"

echo ""
echo "4️⃣  Repair database permissions:"
info "Running permission repair..."
sudo -u postgres psql -d "${DB_NAME}" <<PSQL_EOF
ALTER SCHEMA public OWNER TO ${DB_USER};
GRANT USAGE, CREATE ON SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
PSQL_EOF
success "Database permissions repaired"

echo ""
echo "5️⃣  Retry build with verbose output:"
info "This will help diagnose if Prisma can connect now..."
cd "$APP_DIR/backend"
export DATABASE_URL="postgresql://${DB_USER}:$(grep POSTGRES_PASSWORD= $APP_DIR/backend/.env | cut -d= -f2)@127.0.0.1:5432/${DB_NAME}?schema=public"
npm run build 2>&1 | tail -30

echo ""
# ISSUE 2: dist/main.js not found
echo ""
echo "────────────────────────────────────────────────────────────"
echo "ISSUE 2: dist/main.js Not Found"
echo "────────────────────────────────────────────────────────────"
echo ""
info "This error means the build failed previously."
echo ""
echo "Steps to recover:"
echo ""

echo "1️⃣  Clean and rebuild:"
cd "$APP_DIR/backend"
rm -rf dist node_modules package-lock.json
npm ci --prefer-offline --no-audit
npm run build

if [ -f "$APP_DIR/backend/dist/main.js" ]; then
  success "Build succeeded! dist/main.js created"
else
  error "Build still failed. Check logs above for details."
  exit 1
fi

echo ""
echo "2️⃣  Run Prisma migrations:"
cd "$APP_DIR/backend"
npx prisma migrate deploy

echo ""
echo "3️⃣  Restart PM2:"
pm2 delete muxro-crm-backend || true
sleep 2
pm2 start npm --name muxro-crm-backend --cwd "$APP_DIR/backend" -- run start:prod
pm2 save

success "PM2 process restarted"

echo ""
echo "4️⃣  Verify health check:"
sleep 5
if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  success "Backend is healthy and responding"
else
  warn "Backend still initializing. Check logs:"
  pm2 logs muxro-crm-backend --lines 50
fi

echo ""
# ISSUE 3: Environment variable issues
echo ""
echo "────────────────────────────────────────────────────────────"
echo "ISSUE 3: Environment Variables Not Set"
echo "────────────────────────────────────────────────────────────"
echo ""
echo "Quick validation:"
echo ""

REQUIRED_VARS=("DATABASE_URL" "JWT_SECRET" "APP_ENCRYPTION_KEY" "ENCRYPTION_SALT")
for VAR in "${REQUIRED_VARS[@]}"; do
  if grep -q "^${VAR}=" "$APP_DIR/backend/.env"; then
    success "✓ $VAR is set"
  else
    error "✗ $VAR is missing!"
  fi
done

echo ""
echo "To regenerate all environment variables:"
echo "  1. Delete current .env files"
echo "  2. Re-run setup script: sudo bash setup-vps.sh"
echo ""

# ISSUE 4: PM2 issues
echo ""
echo "────────────────────────────────────────────────────────────"
echo "ISSUE 4: PM2 Process Management"
echo "────────────────────────────────────────────────────────────"
echo ""
echo "View PM2 status:"
pm2 status

echo ""
echo "View PM2 logs (last 50 lines):"
pm2 logs muxro-crm-backend --lines 50

echo ""
echo "Common fixes:"
echo "  Restart process:  pm2 restart muxro-crm-backend"
echo "  Delete process:   pm2 delete muxro-crm-backend"
echo "  Save PM2 state:   pm2 save"
echo "  Start on reboot:  pm2 startup systemd -u root"
echo ""

# ISSUE 5: Caddy issues
echo ""
echo "────────────────────────────────────────────────────────────"
echo "ISSUE 5: Caddy Reverse Proxy"
echo "────────────────────────────────────────────────────────────"
echo ""
echo "View Caddy status:"
systemctl status caddy || true

echo ""
echo "Reload Caddy config:"
systemctl reload caddy

echo ""
echo "View Caddy logs:"
journalctl -u caddy -n 50

echo ""
# Summary
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Next Steps"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "1. Run full audit: sudo bash production-audit.sh"
echo "2. Check backend logs: pm2 logs muxro-crm-backend"
echo "3. Check Caddy logs: journalctl -u caddy -f"
echo "4. Test health endpoint: curl http://127.0.0.1:3000/api/health"
echo ""
echo "If all checks pass, your production deployment is ready!"
echo ""
