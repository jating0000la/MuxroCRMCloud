#!/usr/bin/env bash

##############################################################################
# MUXRO CRM - QUICK FIXES FOR PRODUCTION READINESS
# Use these commands to fix common deployment issues
##############################################################################

echo "═════════════════════════════════════════════════════════════════════"
echo "MUXRO CRM PRODUCTION READINESS FIXES"
echo "═════════════════════════════════════════════════════════════════════"
echo ""
echo "Choose which issue to fix:"
echo "1) Database Permissions (permission denied for _prisma_migrations)"
echo "2) Restart Backend (PM2)"
echo "3) Restart Caddy (Reverse Proxy)"
echo "4) Check All Services Status"
echo "5) View Backend Logs"
echo "6) View Caddy Logs"
echo "7) Run Full Health Check"
echo ""
echo "Usage: bash $0 [1-7]"
echo ""

if [[ -z "$1" ]]; then
  echo "❌ Please provide an option (1-7)"
  exit 1
fi

case "$1" in

  1)
    echo "🔧 Fixing Database Permissions..."
    echo ""
    echo "This command repairs PostgreSQL ownership for Prisma migrations."
    echo "Run as root on your VPS:"
    echo ""
    echo '---'
    cat << 'SQL'
sudo -u postgres psql -d crm_db <<EOF
ALTER SCHEMA public OWNER TO crm_user;
GRANT USAGE ON SCHEMA public TO crm_user;
GRANT USAGE, CREATE ON SCHEMA public TO crm_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO crm_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO crm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO crm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO crm_user;
EOF
SQL
    echo '---'
    echo ""
    echo "After running the above, retry migrations:"
    echo ""
    echo "cd /root/MuxroCRMCloud/backend"
    echo "npm run build"
    echo "npx prisma migrate deploy"
    echo "pm2 restart muxro-crm-backend"
    echo ""
    ;;

  2)
    echo "🔄 Restarting Backend (PM2)..."
    pm2 restart muxro-crm-backend
    pm2 status
    echo ""
    echo "✅ Backend restarted. Check logs:"
    echo "   pm2 logs muxro-crm-backend"
    ;;

  3)
    echo "🔄 Restarting Caddy..."
    systemctl restart caddy
    sleep 2
    systemctl status caddy --no-pager
    echo ""
    echo "✅ Caddy restarted. Check logs:"
    echo "   journalctl -u caddy -n 20 -f"
    ;;

  4)
    echo "📊 Checking All Services..."
    echo ""
    echo "=== PM2 Backend Status ==="
    pm2 status
    echo ""
    echo "=== Caddy Status ==="
    systemctl status caddy --no-pager
    echo ""
    echo "=== PostgreSQL Status ==="
    systemctl status postgresql --no-pager
    echo ""
    ;;

  5)
    echo "📋 Backend Logs (last 50 lines):"
    echo ""
    pm2 logs muxro-crm-backend --lines 50
    ;;

  6)
    echo "📋 Caddy Logs (last 50 lines):"
    echo ""
    journalctl -u caddy -n 50 -f
    ;;

  7)
    echo "🏥 Running Full Health Check..."
    echo ""
    
    # Backend local check
    if curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null 2>&1; then
      echo "✅ Backend local health: PASS"
    else
      echo "❌ Backend local health: FAIL"
    fi
    
    # Database check
    if sudo -u postgres psql -d crm_db -c "SELECT 1;" >/dev/null 2>&1; then
      echo "✅ Database: PASS"
    else
      echo "❌ Database: FAIL"
    fi
    
    # Caddy check
    if systemctl is-active --quiet caddy; then
      echo "✅ Caddy service: PASS"
    else
      echo "❌ Caddy service: FAIL"
    fi
    
    # PM2 check
    if pm2 describe muxro-crm-backend >/dev/null 2>&1; then
      echo "✅ PM2 backend process: EXISTS"
    else
      echo "❌ PM2 backend process: MISSING"
    fi
    
    # Get domain from Caddyfile
    DOMAIN=$(grep -oP '(?<=^).+?(?=,|{)' /etc/caddy/Caddyfile | head -1)
    
    # Public health check (if domain is configured)
    if [[ -n "$DOMAIN" ]] && [[ "$DOMAIN" != "localhost" ]]; then
      echo ""
      echo "Testing public endpoint: https://$DOMAIN/api/health"
      if curl -fsS "https://$DOMAIN/api/health" >/dev/null 2>&1; then
        echo "✅ Public health check: PASS"
      else
        echo "⚠️  Public health check: UNREACHABLE (DNS may not be live yet)"
      fi
      
      # HSTS check
      if curl -fsSI "https://$DOMAIN" 2>/dev/null | grep -qi "strict-transport-security"; then
        echo "✅ HSTS header: PRESENT"
      else
        echo "❌ HSTS header: MISSING"
      fi
    else
      echo "⚠️  Domain not configured, skipping public checks"
    fi
    
    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    ;;

  *)
    echo "❌ Invalid option. Choose 1-7"
    exit 1
    ;;

esac
