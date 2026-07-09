# MuxRo CRM - Production Deployment Guide

## ✅ System Requirements

- **OS**: Ubuntu 20.04 LTS or Debian 11+
- **RAM**: Minimum 2GB (4GB recommended)
- **Storage**: 20GB free space
- **Network**: Open ports 80 (HTTP) and 443 (HTTPS)

## 🚀 Quick Start (5 Minutes)

### Step 1: Prepare Your VPS

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Clone or update the repository
git clone https://github.com/jating0000la/MuxroCRMCloud.git /root/MuxroCRMCloud
cd /root/MuxroCRMCloud
```

### Step 2: Run Full Setup

```bash
# Default setup (uses muxrocrm.com, /root/MuxroCRMCloud)
sudo bash setup-vps.sh

# OR with custom domain and path
sudo bash setup-vps.sh \
  https://github.com/jating0000la/MuxroCRMCloud.git \
  yourdomain.com \
  /root/MuxroCRMCloud
```

### Step 3: Verify Installation

```bash
# Run the production audit
sudo bash production-audit.sh

# Check if everything is healthy
pm2 status
systemctl status caddy
curl http://127.0.0.1:3000/api/health
```

## 📋 What Gets Set Up Automatically

### Database (PostgreSQL)
- ✅ PostgreSQL 15 installed and running
- ✅ Database `crm_db` created
- ✅ User `crm_user` with all privileges
- ✅ Prisma migration tables initialized
- ✅ All permissions properly configured

### Backend (Node.js + NestJS)
- ✅ Node.js 20.x installed
- ✅ Dependencies installed (`npm ci`)
- ✅ Prisma client generated
- ✅ Database migrations applied
- ✅ Application built (`npm run build`)
- ✅ PM2 process manager configured
- ✅ Auto-restart on boot enabled

### Frontend (React + Vite)
- ✅ Dependencies installed
- ✅ Production build created
- ✅ Static files optimized

### Web Server (Caddy)
- ✅ Caddy installed
- ✅ Reverse proxy configured
- ✅ TLS/HTTPS with Let's Encrypt automatic
- ✅ www→apex redirect (www.domain.com → domain.com)
- ✅ Security headers configured
- ✅ Logging enabled with rotation

## 🔍 Monitoring & Management

### View Backend Logs
```bash
pm2 logs muxro-crm-backend
pm2 logs muxro-crm-backend --lines 100    # Last 100 lines
pm2 logs muxro-crm-backend 2>&1 | tail -50 # Tail 50 lines
```

### View Caddy/Web Logs
```bash
journalctl -u caddy -f                    # Live follow
journalctl -u caddy -n 100               # Last 100 lines
journalctl -u caddy --since "1 hour ago" # Last hour
```

### Manage Backend Process
```bash
pm2 restart muxro-crm-backend    # Restart
pm2 stop muxro-crm-backend       # Stop
pm2 start muxro-crm-backend      # Start
pm2 status                        # View all processes
pm2 delete muxro-crm-backend     # Remove from PM2
```

### Manage Caddy
```bash
systemctl restart caddy          # Restart web server
systemctl stop caddy             # Stop
systemctl start caddy            # Start
systemctl status caddy           # Check status
```

### Database Access
```bash
# Connect to database
psql -U crm_user -d crm_db -h 127.0.0.1

# View tables
psql -U crm_user -d crm_db -c "\dt"

# Run migrations
cd /root/MuxroCRMCloud/backend
npx prisma migrate deploy
```

## ⚠️ Common Errors & Fixes

### Error: "Cannot find module '/root/MuxroCRMCloud/backend/dist/main'"

**Cause**: Build failed during setup

**Fix**:
```bash
cd /root/MuxroCRMCloud/backend
rm -rf dist
npm run build
pm2 restart muxro-crm-backend
```

### Error: "Please provide valid database credentials for 127.0.0.1"

**Cause**: PostgreSQL not accessible or permissions issue

**Fix**:
```bash
# 1. Start PostgreSQL
sudo systemctl start postgresql

# 2. Repair database permissions
sudo -u postgres psql -d crm_db -c "ALTER SCHEMA public OWNER TO crm_user;"

# 3. Rebuild
cd /root/MuxroCRMCloud/backend
npm run build
```

### Error: "permission denied for table _prisma_migrations"

**Cause**: User doesn't have permissions on the schema

**Fix**:
```bash
sudo -u postgres psql -d crm_db <<EOF
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO crm_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO crm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO crm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO crm_user;
EOF

cd /root/MuxroCRMCloud/backend
npx prisma migrate deploy
pm2 restart muxro-crm-backend
```

### Error: "Cannot GET /api/health"

**Cause**: Backend not running or port blocked

**Fix**:
```bash
# Check if PM2 process is running
pm2 status

# View logs to see what's wrong
pm2 logs muxro-crm-backend --lines 100

# Restart
pm2 restart muxro-crm-backend
```

### HTTPS Certificate Not Issued

**Cause**: Caddy needs email for certificate verification

**Fix**:
```bash
# Edit Caddyfile
nano /etc/caddy/Caddyfile

# Add email at top:
{
  email admin@yourdomain.com
}

# Reload
systemctl reload caddy
```

## 🔐 Security Checklist

- [ ] Database credentials are in a file with 600 permissions
  ```bash
  chmod 600 /root/MuxroCRMCloud/DEPLOYMENT_SECRETS.txt
  ```

- [ ] Backend runs as non-root user (in PM2)
  ```bash
  pm2 status
  ```

- [ ] Firewall allows only 80/443
  ```bash
  sudo ufw status
  sudo ufw allow 80
  sudo ufw allow 443
  ```

- [ ] SSH uses strong keys, password auth disabled
  ```bash
  cat /etc/ssh/sshd_config | grep -i passwordauth
  ```

- [ ] HSTS header enabled
  ```bash
  curl -I https://yourdomain.com | grep -i strict-transport-security
  ```

## 🔄 Deployment Updates

### Pull Latest Changes
```bash
cd /root/MuxroCRMCloud
git pull origin main
```

### Rebuild Backend
```bash
cd /root/MuxroCRMCloud/backend
npm ci
npm run build
pm2 restart muxro-crm-backend
```

### Rebuild Frontend
```bash
cd /root/MuxroCRMCloud/frontend
npm ci
npm run build
systemctl reload caddy
```

### Run Migrations
```bash
cd /root/MuxroCRMCloud/backend
npx prisma migrate deploy
pm2 restart muxro-crm-backend
```

## 📊 Health Check Endpoints

```bash
# Backend health
curl -s http://127.0.0.1:3000/api/health | jq .

# Frontend via Caddy
curl -I https://muxrocrm.com/

# Database connectivity
psql -U crm_user -d crm_db -c "SELECT NOW();"
```

## 🆘 Emergency Support

If deployment fails or you get stuck:

1. **Run troubleshooting script**:
   ```bash
   sudo bash troubleshoot-deployment.sh
   ```

2. **Run full audit**:
   ```bash
   sudo bash production-audit.sh muxrocrm.com /root/MuxroCRMCloud crm_db crm_user
   ```

3. **Collect debug information**:
   ```bash
   pm2 logs muxro-crm-backend > backend.log
   journalctl -u caddy > caddy.log
   sudo -u postgres psql -d crm_db -c "\dt" > db_schema.log
   ```

4. **Share logs with support**:
   ```bash
   cat backend.log caddy.log db_schema.log
   ```

## ✨ You're Ready!

Your MuxRo CRM application is now production-ready:
- ✅ Secure HTTPS with automatic certificate renewal
- ✅ Automated database backups (configure separately)
- ✅ PM2 process auto-restart on failure
- ✅ Caddy automatic HTTP/2 and compression
- ✅ Scalable from 1 to 1000s of users

**Next Steps**:
1. Configure your domain DNS to point to this server
2. Wait for DNS propagation (up to 48 hours)
3. Caddy will auto-obtain Let's Encrypt certificate
4. Monitor logs regularly
5. Set up automated backups for PostgreSQL
