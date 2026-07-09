#!/usr/bin/env bash

set -euo pipefail

DOMAIN="${1:-muxrocrm.com}"
APP_DIR="${2:-/root/MuxroCRMCloud}"
API_PORT="${3:-3000}"
PM2_APP="${4:-muxro-crm-backend}"

pass() {
  echo "[PASS] $1"
}

warn() {
  echo "[WARN] $1"
}

fail() {
  echo "[FAIL] $1"
}

echo "=== Muxro CRM VPS Audit ==="
echo "Domain: ${DOMAIN}"
echo "App dir: ${APP_DIR}"
echo "API port: ${API_PORT}"
echo "PM2 app: ${PM2_APP}"
echo ""

if pm2 describe "${PM2_APP}" >/dev/null 2>&1; then
  pass "PM2 process '${PM2_APP}' exists"
else
  fail "PM2 process '${PM2_APP}' is missing"
fi

if pm2 jlist | grep -q '"status":"online"'; then
  pass "At least one PM2 process is online"
else
  fail "No PM2 process is online"
fi

if systemctl is-active --quiet caddy; then
  pass "Caddy service is active"
else
  fail "Caddy service is not active"
fi

if [ -f "${APP_DIR}/backend/dist/main.js" ]; then
  pass "Backend build artifact exists at ${APP_DIR}/backend/dist/main.js"
else
  fail "Missing ${APP_DIR}/backend/dist/main.js"
fi

if curl -fsS "http://127.0.0.1:${API_PORT}/api/health" >/dev/null; then
  pass "Local backend health check passed"
else
  fail "Local backend health check failed"
fi

if curl -fsS "https://${DOMAIN}/api/health" >/dev/null; then
  pass "Public HTTPS API health check passed"
else
  fail "Public HTTPS API health check failed"
fi

if curl -fsSI "https://${DOMAIN}" | grep -qi "strict-transport-security"; then
  pass "HSTS header present"
else
  warn "HSTS header missing"
fi

if curl -fsSI "https://www.${DOMAIN}" | grep -q "308\|301"; then
  pass "www redirect is configured"
else
  warn "www redirect not detected"
fi

if command -v openssl >/dev/null 2>&1; then
  EXPIRY_RAW="$(echo | openssl s_client -servername "${DOMAIN}" -connect "${DOMAIN}:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null || true)"
  if [ -n "${EXPIRY_RAW}" ]; then
    pass "Certificate expiry: ${EXPIRY_RAW}"
  else
    warn "Could not read certificate expiry"
  fi
fi

echo ""
echo "=== Audit complete ==="
