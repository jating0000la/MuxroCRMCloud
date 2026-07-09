#!/usr/bin/env bash

################################################################################
# MuxRo CRM - Production Readiness Audit & Troubleshooting
# Validates: Database, Backend, Frontend, PM2, Caddy, Environment
# Usage: sudo bash production-audit.sh [domain] [app_dir] [db_name] [db_user]
################################################################################

set -e

DOMAIN="${1:-muxrocrm.com}"
APP_DIR="${2:-/root/MuxroCRMCloud}"
DB_NAME="${3:-crm_db}"
DB_USER="${4:-crm_user}"
API_PORT="3000"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; }
fail() { echo -e "${RED}✗ FAIL${NC}: $1"; }
warn() { echo -e "${YELLOW}⚠ WARN${NC}: $1"; }
info() { echo -e "${YELLOW}ℹ INFO${NC}: $1"; }

echo "════════════════════════════════════════════════════════════"
echo "  MuxRo CRM - Production Readiness Audit"
echo "════════════════════════════════════════════════════════════"
echo ""

# 1. DATABASE CHECKS
echo "── DATABASE CHECKS ──"
if command -v psql >/dev/null 2>&1; then
  pass "PostgreSQL client installed"
else
  fail "PostgreSQL client not found"
  exit 1
fi

if systemctl is-active --quiet postgresql; then
  pass "PostgreSQL service is running"
else
  fail "PostgreSQL service is not running. Start with: systemctl start postgresql"
  exit 1
fi

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  pass "Database '${DB_NAME}' exists"
else
  fail "Database '${DB_NAME}' does not exist"
  exit 1
fi

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  pass "Database user '${DB_USER}' exists"
else
  fail "Database user '${DB_USER}' does not exist"
  exit 1
fi

# Check schema permissions
SCHEMA_OWNER=$(sudo -u postgres psql -d "${DB_NAME}" -tAc "SELECT pg_catalog.pg_get_userbyid(nspowner) FROM pg_catalog.pg_namespace WHERE nspname = 'public'")
if [[ "$SCHEMA_OWNER" == "$DB_USER" ]]; then
  pass "Public schema is owned by ${DB_USER}"
else
  warn "Public schema owned by '${SCHEMA_OWNER}' (not ${DB_USER}). Repairing..."
  sudo -u postgres psql -d "${DB_NAME}" -c "ALTER SCHEMA public OWNER TO ${DB_USER};"
  pass "Schema ownership repaired"
fi

# Check Prisma migrations table
MIGRATION_TABLE=$(sudo -u postgres psql -d "${DB_NAME}" -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prisma_migrations'" || true)
if [[ -n "$MIGRATION_TABLE" ]]; then
  pass "Prisma migrations table exists"
else
  info "_prisma_migrations table not yet created (will be created on first migration)"
fi

# 2. BACKEND CHECKS
echo ""
echo "── BACKEND CHECKS ──"
if [ -d "$APP_DIR/backend" ]; then
  pass "Backend directory found at $APP_DIR/backend"
else
  fail "Backend directory not found at $APP_DIR/backend"
  exit 1
fi

if [ -f "$APP_DIR/backend/.env" ]; then
  pass "Backend .env file exists"
  REQUIRED_VARS=("DATABASE_URL" "JWT_SECRET" "APP_ENCRYPTION_KEY" "ENCRYPTION_SALT")
  for VAR in "${REQUIRED_VARS[@]}"; do
    if grep -q "^${VAR}=" "$APP_DIR/backend/.env"; then
      pass "Environment variable ${VAR} is set"
    else
      fail "Environment variable ${VAR} is missing from .env"
    fi
  done
else
  fail "Backend .env file not found"
  exit 1
fi

if [ -f "$APP_DIR/backend/dist/main.js" ]; then
  pass "Backend build artifact (dist/main.js) exists"
else
  warn "Backend build artifact not found. Run: cd $APP_DIR/backend && npm run build"
fi

if command -v node >/dev/null 2>&1; then
  NODE_VERSION=$(node -v)
  pass "Node.js installed: $NODE_VERSION"
else
  fail "Node.js not installed"
  exit 1
fi

# 3. FRONTEND CHECKS
echo ""
echo "── FRONTEND CHECKS ──"
if [ -d "$APP_DIR/frontend" ]; then
  pass "Frontend directory found at $APP_DIR/frontend"
else
  fail "Frontend directory not found at $APP_DIR/frontend"
  exit 1
fi

if [ -d "$APP_DIR/frontend/dist" ]; then
  pass "Frontend build (dist/) exists"
  FILE_COUNT=$(find "$APP_DIR/frontend/dist" -type f | wc -l)
  pass "Frontend build contains $FILE_COUNT files"
else
  warn "Frontend build not found. Run: cd $APP_DIR/frontend && npm run build"
fi

# 4. PM2 CHECKS
echo ""
echo "── PM2 CHECKS ──"
if command -v pm2 >/dev/null 2>&1; then
  pass "PM2 is installed"
else
  fail "PM2 not installed. Run: npm install -g pm2"
  exit 1
fi

if pm2 list | grep -q "online"; then
  pass "PM2 has at least one process running"
  pm2 list | grep "muxro-crm-backend" || warn "muxro-crm-backend process not found in PM2"
else
  warn "No PM2 processes are running"
fi

# 5. CADDY CHECKS
echo ""
echo "── CADDY CHECKS ──"
if command -v caddy >/dev/null 2>&1; then
  pass "Caddy is installed"
  CADDY_VERSION=$(caddy version 2>&1 | head -1)
  info "Caddy version: $CADDY_VERSION"
else
  fail "Caddy not installed"
  exit 1
fi

if systemctl is-active --quiet caddy; then
  pass "Caddy service is running"
else
  fail "Caddy service is not running. Start with: systemctl start caddy"
  exit 1
fi

if [ -f "/etc/caddy/Caddyfile" ]; then
  pass "Caddyfile exists at /etc/caddy/Caddyfile"
else
  fail "Caddyfile not found"
  exit 1
fi

# 6. LOCAL API CHECKS
echo ""
echo "── LOCAL API CONNECTIVITY ──"
if curl -fsS "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1; then
  pass "Backend API is responding on 127.0.0.1:${API_PORT}"
else
  fail "Backend API is not responding on 127.0.0.1:${API_PORT}"
  info "Waiting 10 seconds and retrying..."
  sleep 10
  if curl -fsS "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1; then
    pass "Backend API is now responding (was still initializing)"
  else
    warn "Backend API still not responding. Check logs with: pm2 logs muxro-crm-backend"
  fi
fi

# 7. PUBLIC HTTPS CHECKS
echo ""
echo "── PUBLIC HTTPS CONNECTIVITY ──"
if [[ "$DOMAIN" != "_" ]]; then
  if curl -fsS "https://${DOMAIN}/api/health" >/dev/null 2>&1; then
    pass "Public HTTPS API is accessible at https://${DOMAIN}"
  else
    warn "Public HTTPS API not yet accessible at https://${DOMAIN}"
    info "If DNS is newly configured, wait up to 48 hours for propagation"
  fi
  
  if curl -fsSI "https://${DOMAIN}" | grep -qi "strict-transport-security"; then
    pass "HSTS security header is present"
  else
    warn "HSTS header not detected"
  fi
fi

# 8. FILE PERMISSIONS CHECK
echo ""
echo "── FILE PERMISSIONS ──"
if [ -f "$APP_DIR/DEPLOYMENT_SECRETS.txt" ]; then
  PERMS=$(stat -c '%a' "$APP_DIR/DEPLOYMENT_SECRETS.txt" 2>/dev/null || stat -f '%A' "$APP_DIR/DEPLOYMENT_SECRETS.txt" 2>/dev/null)
  if [[ "$PERMS" == "600" ]] || [[ "$PERMS" == "-rw-------" ]]; then
    pass "Secrets file has restricted permissions (600)"
  else
    warn "Secrets file permissions are too open: $PERMS. Should be 600"
  fi
else
  info "No DEPLOYMENT_SECRETS.txt found (optional)"
fi

# 9. SUMMARY
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Audit Complete"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Quick Commands Reference:"
echo "  View PM2 logs:     pm2 logs muxro-crm-backend"
echo "  Restart backend:   pm2 restart muxro-crm-backend"
echo "  View Caddy logs:   journalctl -u caddy -f"
echo "  Check DB:          psql -U ${DB_USER} -d ${DB_NAME} -c '\\dt'"
echo "  Health check:      curl -s http://127.0.0.1:${API_PORT}/api/health | jq ."
echo ""
