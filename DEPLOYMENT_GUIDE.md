# MUXRO CRM - PRODUCTION DEPLOYMENT GUIDE

**Last Updated:** 2026-07-09  
**System Status:** ✅ Production Ready

---

## Quick Start (Choose One)

### Option A: Docker Compose (Recommended - Easiest)

1. **Install Docker & Docker Compose**
   ```bash
   curl -fsSL https://get.docker.com | sh
   curl -fsSL https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
   chmod +x /usr/local/bin/docker-compose
   ```

2. **Clone & Configure**
   ```bash
   git clone https://github.com/jating0000la/MuxroCRMCloud.git /opt/muxro-crm
   cd /opt/muxro-crm
   cp .env.example .env
   ```

3. **Edit `.env`** (Critical!)
   ```bash
   nano .env  # or vim
   ```
   
   Update these fields:
   ```
   POSTGRES_PASSWORD=YourStrongPassword123!
   JWT_SECRET=$(openssl rand -base64 48)
   DOMAIN=muxrocrm.com
   ACME_EMAIL=admin@muxrocrm.com
   ```

4. **Deploy**
   ```bash
   docker compose up -d
   docker compose logs -f backend  # Wait for "Listening on port 3000"
   ```

5. **Verify** (after DNS propagates ~1-5 min)
   ```bash
   curl https://muxrocrm.com/api/health
   # Should return: {"status":"ok"}
   ```

---

### Option B: VPS Deployment (Ubuntu/Debian)

1. **SSH to your VPS as root**
   ```bash
   ssh root@your-vps-ip
   ```

2. **Configure Environment**
   ```bash
   nano ~/.env  # or vim
   ```
   
   Add these critical variables (also in `/opt/muxro-crm/.env` if not root home):
   ```
   POSTGRES_PASSWORD=YourStrongPassword123!
   POSTGRES_DB=crm_db
   POSTGRES_USER=postgres
   JWT_SECRET=$(openssl rand -base64 48)
   DOMAIN=muxrocrm.com
   ACME_EMAIL=admin@muxrocrm.com
   # CRITICAL: DATABASE_URL must use 127.0.0.1 for VPS (not 'host' or 'postgres')
   DATABASE_URL="postgresql://postgres:YourStrongPassword123!@127.0.0.1:5432/crm_db?schema=public"
   ```

3. **Run Automated Setup**
   ```bash
   bash <(curl -s https://raw.githubusercontent.com/jating0000la/MuxroCRMCloud/main/setup-vps.sh) \
     https://github.com/jating0000la/MuxroCRMCloud.git \
     muxrocrm.com \
     /root/MuxroCRMCloud
   ```

   Or download and run locally:
   ```bash
   curl -O https://raw.githubusercontent.com/jating0000la/MuxroCRMCloud/main/setup-vps.sh
   sudo bash setup-vps.sh
   # Defaults: domain=muxrocrm.com, dir=/root/MuxroCRMCloud
   ```

3. **Monitor Setup**
   ```bash
   tail -f /var/log/setup-vps.log  # If logging enabled
   pm2 logs muxro-crm-backend      # Watch backend start
   ```

4. **Verify**
   ```bash
   pm2 status
   curl http://127.0.0.1:3000/api/health
   # Wait for DNS & Caddy SSL (30-60 sec):
   curl https://muxrocrm.com/api/health
   ```

---

## Key Files & Their Purpose

| File | Purpose | When Used |
|------|---------|-----------|
| **setup-vps.sh** | One-shot VPS bootstrap (Debian/Ubuntu) | VPS deployments only |
| **docker-compose.yml** | Multi-container orchestration | Docker deployments only |
| **Caddyfile** | Reverse proxy, SSL, routing | Both Docker & VPS |
| **backend/ecosystem.config.cjs** | PM2 process management config | VPS deployments |
| **quick-fixes.sh** | Troubleshooting & health checks | Production maintenance |
| **PRODUCTION_AUDIT.md** | System readiness checklist | Pre-deployment review |

---

## Common Tasks

### View Logs

**Docker:**
```bash
docker compose logs -f backend    # Backend output
docker compose logs -f caddy       # Caddy output
docker compose logs -f postgres    # Database output
```

**VPS:**
```bash
pm2 logs muxro-crm-backend         # Backend output
journalctl -u caddy -f             # Caddy output
tail -f /var/log/postgresql/...    # Database output
```

### Restart Services

**Docker:**
```bash
docker compose restart backend     # Restart backend only
docker compose restart caddy       # Restart reverse proxy
docker compose down && docker compose up -d  # Full restart
```

**VPS:**
```bash
pm2 restart muxro-crm-backend
systemctl restart caddy
sudo systemctl restart postgresql
```

### View System Status

**Docker:**
```bash
docker compose ps
docker compose stats
```

**VPS:**
```bash
bash quick-fixes.sh 4  # All services
# or individually:
pm2 status
systemctl status caddy
systemctl status postgresql
```

### Full Health Check

**Docker:**
```bash
docker compose exec backend curl http://localhost:3000/api/health
```

**VPS:**
```bash
bash quick-fixes.sh 7  # Runs complete health check
```

### Update Application

**Docker:**
```bash
cd /opt/muxro-crm
git pull origin main
docker compose down
docker compose build --no-cache
docker compose up -d
```

**VPS:**
```bash
cd /root/MuxroCRMCloud
git pull origin main
cd backend && npm ci && npm run build && npx prisma migrate deploy && cd ..
cd frontend && npm ci && npm run build && cd ..
pm2 restart muxro-crm-backend
```

---

## Troubleshooting

### Issue: "permission denied for table _prisma_migrations"

**Solution (VPS):**
```bash
bash quick-fixes.sh 1  # Shows the SQL command to run
# Then:
pm2 restart muxro-crm-backend
```

### Issue: Caddy can't obtain SSL certificate

**Check:**
```bash
docker compose logs caddy  # Docker
journalctl -u caddy -n 50  # VPS
```

**Ensure:**
- DNS points to server: `dig muxrocrm.com`
- Port 80/443 accessible: `curl http://muxrocrm.com`
- ACME_EMAIL is set in `.env`

### Issue: Backend not responding

**VPS:**
```bash
bash quick-fixes.sh 5         # View logs
pm2 restart muxro-crm-backend
curl http://127.0.0.1:3000/api/health
```

**Docker:**
```bash
docker compose logs backend -f
docker compose restart backend
```

### Issue: Prisma Error "Can't reach database server at `host:5432`"

This means `DATABASE_URL` is missing or contains the literal hostname `host` instead of `127.0.0.1`.

**VPS Fix:**
```bash
# Check if DATABASE_URL is set
grep DATABASE_URL ~/.env

# If missing or wrong, add the correct one:
echo 'DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/crm_db?schema=public"' >> ~/.env
source ~/.env

# Then retry Prisma:
cd ~/MuxroCRMCloud/backend
npx prisma migrate deploy
```

**Docker Fix:**
```bash
# DATABASE_URL should reference 'postgres' (container name), not 'host' or '127.0.0.1'
# Check docker-compose.yml backend environment section:
docker compose config | grep DATABASE_URL
```

### Issue: Database won't connect

**Check connection string in `.env`:**
```
# Docker (default):
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/crm_db?schema=public

# VPS (default):
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/crm_db?schema=public
```

**Test connection:**
```bash
# Docker:
docker compose exec postgres psql -U postgres -d crm_db -c "SELECT 1;"

# VPS:
psql "postgresql://crm_user:password@127.0.0.1:5432/crm_db" -c "SELECT 1;"
```

---

## Environment Variables Reference

### Required (Set in `.env`)

| Variable | Example | Purpose |
|----------|---------|---------|
| `DOMAIN` | `muxrocrm.com` | Website domain (Caddy SSL) |
| `ACME_EMAIL` | `admin@muxrocrm.com` | Caddy certificate renewal notifications |
| `JWT_SECRET` | `generated` | Backend JWT signing key |
| `POSTGRES_PASSWORD` | `strong_password` | Database root password |

### Auto-Generated (Do not change)

These are created during setup with cryptographically strong values:
- `APP_ENCRYPTION_KEY` - Data encryption
- `ENCRYPTION_SALT` - Encryption salt
- `DB_USER` - Database user (default: `crm_user`)
- `DB_NAME` - Database name (default: `crm_db`)

### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `SWAGGER_ENABLED` | `false` | Enable Swagger API docs (development only) |
| `PUBLIC_FORMS_ENABLED` | `true` | Allow public form submissions |
| `NODE_ENV` | `production` | Don't change in production |

---

## Monitoring & Maintenance

### Daily Checks

```bash
# VPS:
bash quick-fixes.sh 7  # Full health check (every day)

# Docker:
docker compose ps      # All containers running?
docker compose logs --tail=20 backend caddy  # Any errors?
```

### Weekly Tasks

- Check certificate expiry: `openssl s_client -servername muxrocrm.com -connect muxrocrm.com:443 2>/dev/null | openssl x509 -noout -enddate`
- Review logs: `docker compose logs --since 7d | grep ERROR`
- Backup database: `docker compose exec postgres pg_dump -U postgres crm_db > backup-$(date +%Y%m%d).sql`

### Monthly Tasks

- Update dependencies: `npm update` in both backend & frontend
- Review & apply security patches
- Test disaster recovery (restore from backup)
- Review performance metrics

---

## Security Checklist

Before going live, verify:

- [ ] HTTPS/SSL enabled and working (HSTS header present)
- [ ] CORS_ORIGIN set to production domain only
- [ ] JWT_SECRET is a strong random string (not default)
- [ ] Database password is strong (not default)
- [ ] APP_ENCRYPTION_KEY is set
- [ ] SWAGGER_ENABLED=false (disable in production)
- [ ] Backups scheduled (automated daily)
- [ ] Firewall allows only 80, 443, (22 for SSH)
- [ ] Regular security updates scheduled
- [ ] Error logs don't expose sensitive info

---

## Performance Tips

1. **Frontend:** Static assets cached 1 year (automatic via Caddy)
2. **Backend:** Rate limiting 100 req/min (adjust in `src/app.module.ts`)
3. **Database:** Indexes on common fields (campaigns, leads, users)
4. **Docker:** Memory limits set appropriately
5. **VPS:** Monitor via `pm2 monit` or `top`

---

## Support & Documentation

- **Issue Tracker:** [GitHub Issues](https://github.com/jating0000la/MuxroCRMCloud/issues)
- **Quick Fixes:** `bash quick-fixes.sh`
- **Audit Report:** See `PRODUCTION_AUDIT.md`
- **System Readiness:** `bash audit-vps.sh` (VPS only)

---

## Next Steps After Deployment

1. ✅ Test all endpoints in your CRM
2. ✅ Set up backup strategy
3. ✅ Configure monitoring/alerting (optional but recommended)
4. ✅ Train users on system
5. ✅ Document custom configurations

---

**Deployed Successfully? 🎉**

Run health check to confirm:
```bash
curl https://muxrocrm.com/api/health
```

Should return:
```json
{"status":"ok"}
```

If you see this, you're production-ready! 🚀
