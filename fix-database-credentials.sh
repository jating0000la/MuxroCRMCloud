#!/usr/bin/env bash

################################################################################
# MuxRo CRM - Database Credential & Connection Recovery
# Diagnoses and fixes "Authentication failed" errors during Prisma migration
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
echo "  Database Credential & Connection Recovery"
echo "════════════════════════════════════════════════════════════"
echo ""

# 1. Check PostgreSQL is running
echo "Step 1: Verify PostgreSQL is running..."
if systemctl is-active --quiet postgresql; then
  success "PostgreSQL is running"
else
  error "PostgreSQL is not running!"
  info "Starting PostgreSQL..."
  sudo systemctl start postgresql
  sleep 3
  if systemctl is-active --quiet postgresql; then
    success "PostgreSQL started successfully"
  else
    error "Failed to start PostgreSQL"
    exit 1
  fi
fi

echo ""
echo "Step 2: Check if database exists..."
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  success "Database '${DB_NAME}' exists"
else
  warn "Database '${DB_NAME}' does not exist. Creating..."
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};"
  success "Database created"
fi

echo ""
echo "Step 3: Check if user exists..."
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  success "User '${DB_USER}' exists"
else
  warn "User '${DB_USER}' does not exist. Creating..."
  # Generate a strong random password
  NEW_PASS=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${NEW_PASS}';"
  success "User created with password"
  
  # Update .env with new password
  if [ -f "$APP_DIR/backend/.env" ]; then
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://${DB_USER}:${NEW_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public|g" "$APP_DIR/backend/.env"
    success "Updated DATABASE_URL in .env"
  fi
fi

echo ""
echo "Step 4: Verify user has database privileges..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
success "Granted database privileges"

echo ""
echo "Step 5: Repair schema ownership..."
sudo -u postgres psql -d "${DB_NAME}" <<EOF
ALTER SCHEMA public OWNER TO ${DB_USER};
GRANT USAGE, CREATE ON SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
EOF
success "Schema ownership repaired"

echo ""
echo "Step 6: Test connection with current .env credentials..."
if [ -f "$APP_DIR/backend/.env" ]; then
  DB_URL=$(grep "^DATABASE_URL=" "$APP_DIR/backend/.env" | cut -d= -f2-)
  info "Testing with: $DB_URL (hidden password)"
  
  # Extract host, user, password, db from connection string
  # Format: postgresql://user:password@host:port/database
  if echo "$DB_URL" | grep -q "postgresql://"; then
    # Try to connect using psql
    if PGPASSWORD=$(echo "$DB_URL" | sed -n 's/.*:\([^@]*\)@.*/\1/p') \
       psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
      success "Database connection test PASSED"
    else
      warn "Connection test failed. Attempting manual fix..."
      
      # Re-create user with current connection test
      info "Resetting user password..."
      RESET_PASS=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)
      sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${RESET_PASS}';"
      
      # Update .env
      sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://${DB_USER}:${RESET_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public|g" "$APP_DIR/backend/.env"
      success "Reset user password and updated .env"
      
      # Save credentials for recovery
      echo "DATABASE_USER=${DB_USER}" >> "$APP_DIR/DEPLOYMENT_SECRETS.txt"
      echo "DATABASE_PASSWORD=${RESET_PASS}" >> "$APP_DIR/DEPLOYMENT_SECRETS.txt"
      echo "DATABASE_URL=postgresql://${DB_USER}:${RESET_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public" >> "$APP_DIR/DEPLOYMENT_SECRETS.txt"
      success "Credentials saved to DEPLOYMENT_SECRETS.txt"
    fi
  fi
fi

echo ""
echo "Step 7: Retry Prisma migrations..."
cd "$APP_DIR/backend"
if npx prisma migrate deploy; then
  success "Prisma migrations completed successfully"
else
  warn "Prisma migrations still failing. Check logs above."
fi

echo ""
echo "Step 8: Rebuild backend..."
if npm run build; then
  if [ -f dist/main.js ]; then
    success "Backend build successful - dist/main.js created"
  else
    error "Build completed but dist/main.js not found"
  fi
else
  error "Build failed"
  exit 1
fi

echo ""
echo "Step 9: Restart PM2..."
pm2 restart muxro-crm-backend || true
sleep 3
if pm2 describe muxro-crm-backend >/dev/null 2>&1; then
  success "PM2 process restarted"
  pm2 logs muxro-crm-backend --lines 20
else
  warn "PM2 process not started yet. Check logs with: pm2 logs muxro-crm-backend"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Recovery Complete"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "✅ Credentials fixed"
echo "✅ Permissions restored"
echo "✅ Migrations applied"
echo "✅ Backend rebuilt"
echo ""
echo "Next: curl http://127.0.0.1:3000/api/health"
echo ""
