# MuxRo Ultimate CRM - Setup & Deployment Guide

This guide covers installation and deployment of MuxRo Ultimate CRM on your infrastructure.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Docker Compose)](#quick-start-docker-compose)
3. [Environment Configuration](#environment-configuration)
4. [Deployment on VPS](#deployment-on-vps)
5. [SSL/TLS Setup](#ssltls-setup)
6. [Database Setup](#database-setup)
7. [Post-Deployment Steps](#post-deployment-steps)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Docker** (v20.10+): [Install Docker](https://docs.docker.com/engine/install/)
- **Docker Compose** (v1.29+): [Install Docker Compose](https://docs.docker.com/compose/install/)
- **Git**: For cloning the repository
- **Bash/Shell**: For running deployment scripts

### System Requirements

- **CPU**: 2 cores minimum (4+ recommended)
- **RAM**: 2GB minimum (4GB+ recommended)
- **Storage**: 20GB for initial setup (scales with database)
- **Network**: Open ports 80 (HTTP) and 443 (HTTPS)

### Domain Setup

- A registered domain name
- DNS access to point domain to your server
- (Optional but recommended) Access to domain registrar for SSL certificate setup

---

## Quick Start (Docker Compose)

### 1. Clone the Repository

```bash
git clone <your-repo-url> muxro-crm
cd muxro-crm
```

### 2. Create Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
POSTGRES_PASSWORD=your_strong_password_here

# JWT Secret (generate with: openssl rand -base64 48)
JWT_SECRET=generate_random_string_here

# Your domain
CORS_ORIGIN=https://yourdomain.com
DOMAIN=yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
```

### 3. Start Services

**Development Mode:**
```bash
docker compose up -d
```

**Production Mode (with build):**
```bash
docker compose build --no-cache
docker compose up -d
```

### 4. Wait for Services

Wait 30-60 seconds for all services to be healthy:

```bash
docker compose ps
```

You should see all containers in "Up" status.

### 5. Run Database Migrations

```bash
docker compose exec backend npx prisma migrate deploy
```

### 6. Access the Application

- **Frontend**: `http://localhost` (or your domain)
- **Backend API**: `http://localhost:3000/api`
- **API Documentation** (if enabled): `http://localhost:3000/api/docs`

---

## Environment Configuration

### Environment Variables Reference

#### Database Configuration

```env
# PostgreSQL Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=strong_secure_password_12345!
POSTGRES_DB=crm_db
```

- **POSTGRES_USER**: Database user (default: postgres)
- **POSTGRES_PASSWORD**: Strong password for database (required)
- **POSTGRES_DB**: Database name (default: crm_db)

#### Application Configuration

```env
# JWT Authentication
JWT_SECRET=your_base64_encoded_secret_string_here
JWT_EXPIRATION=7d
```

Generate secure JWT_SECRET:
```bash
openssl rand -base64 48
```

- **JWT_SECRET**: Secret key for JWT tokens (required)
- **JWT_EXPIRATION**: Token expiration time (default: 7d)

#### Network & Domain

```env
# CORS Configuration
CORS_ORIGIN=https://yourdomain.com

# SSL/Domain Setup
DOMAIN=yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
```

- **CORS_ORIGIN**: Allowed origin for frontend (exact domain)
- **DOMAIN**: Your domain name (for SSL certificates)
- **ADMIN_EMAIL**: Email for SSL certificate notifications

#### Feature Flags

```env
# API Documentation (disable in production)
SWAGGER_ENABLED=false

# Public Form Submissions
PUBLIC_FORMS_ENABLED=true

# Node Environment
NODE_ENV=production
PORT=3000
```

---

## Deployment on VPS

### Automated Deployment Script

The repository includes an automated deployment script:

```bash
chmod +x deploy.sh
./deploy.sh
```

**What the script does:**
1. ✅ Checks Docker and Docker Compose installation
2. ✅ Creates `.env` file from template
3. ✅ Generates random JWT_SECRET
4. ✅ Builds Docker images
5. ✅ Starts all services
6. ✅ Runs database migrations

### Manual Deployment Steps

If you prefer manual control:

#### Step 1: Connect to Your VPS

```bash
ssh user@your-vps-ip
```

#### Step 2: Install Docker & Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

#### Step 3: Clone Repository

```bash
git clone <your-repo-url> muxro-crm
cd muxro-crm
```

#### Step 4: Configure Environment

```bash
cp .env.example .env
nano .env  # Edit with your values
```

**Important settings:**
- Set strong `POSTGRES_PASSWORD`
- Generate and set `JWT_SECRET`
- Set `CORS_ORIGIN` to your domain
- Set `DOMAIN` and `ADMIN_EMAIL`

#### Step 5: Build and Start

```bash
docker compose build --no-cache
docker compose up -d
```

#### Step 6: Verify Services

```bash
docker compose ps
docker compose logs -f backend
```

All containers should be healthy after 1-2 minutes.

#### Step 7: Setup SSL Certificates

```bash
chmod +x setup-ssl.sh
./setup-ssl.sh
```

This configures Let's Encrypt SSL certificates.

---

## SSL/TLS Setup

### Automated SSL Setup

Use the provided script:

```bash
chmod +x setup-ssl.sh
./setup-ssl.sh
```

**Interactive setup:**
1. Enter your domain
2. Enter admin email
3. Script configures Let's Encrypt certificates
4. Auto-renewal scheduled

### Manual SSL Setup

#### 1. Point Domain DNS Records

Point your domain to your VPS IP:
```
A record: yourdomain.com -> your-vps-ip
CNAME: www.yourdomain.com -> yourdomain.com
```

Wait for DNS propagation (15-30 minutes).

#### 2. Generate Let's Encrypt Certificate

```bash
docker compose exec certbot certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d yourdomain.com \
  -d www.yourdomain.com
```

#### 3. Configure Nginx

Edit `nginx/conf.d/default.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # ... rest of configuration
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

#### 4. Restart Nginx

```bash
docker compose restart nginx
```

### Certificate Auto-Renewal

Certbot container automatically renews certificates:
- Runs renewal check every 12 hours
- Automatically reloads Nginx on renewal
- No manual intervention needed

---

## Database Setup

### Initial Database Setup

The database is automatically initialized on first run:

```bash
docker compose up -d postgres
```

Wait for database to be ready:
```bash
docker compose logs postgres
```

### Running Migrations

Apply database schema:

```bash
docker compose exec backend npx prisma migrate deploy
```

### Database Backup

#### Manual Backup

```bash
docker compose exec postgres pg_dump \
  -U postgres crm_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Automated Backups

Create a backup script:

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/backups/crm"
mkdir -p $BACKUP_DIR

docker compose exec postgres pg_dump \
  -U postgres crm_db > \
  $BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

Schedule with cron:
```bash
0 2 * * * cd /path/to/muxro-crm && bash backup.sh
```

### Database Restore

```bash
docker compose exec -T postgres psql \
  -U postgres crm_db < backup_20240101_120000.sql
```

### Viewing Database Directly

```bash
docker compose exec postgres psql -U postgres -d crm_db
```

Common commands:
```sql
\dt              -- List all tables
SELECT * FROM "User";  -- View users
\q               -- Exit
```

---

## Post-Deployment Steps

### 1. Create Initial Admin User

```bash
docker compose exec backend npm run seed
```

This creates a default admin user.

### 2. Verify Health Checks

```bash
docker compose ps
```

All containers should show healthy status.

### 3. Test API Connection

```bash
curl http://localhost:3000/api/health
```

Expected response: `{"status":"ok"}`

### 4. Configure Initial Settings

1. **Log in**: Use admin credentials
2. **Go to Settings**: Configure system defaults
3. **Set up campaigns**: Create your first campaign
4. **Invite users**: Add team members

### 5. Enable Public Forms (Optional)

Public forms are enabled by default. To disable:

```env
PUBLIC_FORMS_ENABLED=false
docker compose restart backend
```

### 6. Enable API Documentation (Development Only)

```env
SWAGGER_ENABLED=true
docker compose restart backend
```

Access at: `http://localhost:3000/api/docs`

---

## Docker Services Overview

### Service Components

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **postgres** | postgres:15-alpine | 5432 | PostgreSQL database |
| **backend** | custom NestJS | 3000 | API server |
| **frontend** | custom React/Vite | 3000 (via Nginx) | Web interface |
| **nginx** | nginx:alpine | 80, 443 | Reverse proxy & SSL |
| **certbot** | certbot/certbot | - | SSL certificate management |

### Useful Docker Commands

```bash
# View all containers status
docker compose ps

# View logs
docker compose logs -f backend      # Backend logs
docker compose logs -f frontend     # Frontend logs
docker compose logs -f nginx        # Nginx logs

# Stop services
docker compose down

# Restart a service
docker compose restart backend

# Execute command in container
docker compose exec backend npm run seed

# Remove volumes (CAUTION: deletes data)
docker compose down -v
```

---

## Troubleshooting

### Services Won't Start

**Problem**: Containers fail to start

**Solutions**:
1. Check Docker daemon: `sudo systemctl status docker`
2. View error logs: `docker compose logs`
3. Free up disk space: `docker system prune`
4. Rebuild images: `docker compose build --no-cache`

### Database Connection Error

**Problem**: Backend can't connect to database

**Solutions**:
```bash
# Check database status
docker compose ps postgres

# View database logs
docker compose logs postgres

# Test connection
docker compose exec postgres pg_isready -U postgres

# Restart database
docker compose restart postgres
```

### Frontend Shows Blank Page

**Problem**: Frontend displays nothing or errors

**Solutions**:
1. Check frontend logs: `docker compose logs frontend`
2. Verify CORS_ORIGIN in .env
3. Clear browser cache: Ctrl+F5 or Cmd+Shift+R
4. Rebuild frontend: `docker compose build --no-cache frontend`

### SSL Certificate Issues

**Problem**: HTTPS not working or certificate errors

**Solutions**:
```bash
# Check certificate status
docker compose exec certbot certbot certificates

# Renew certificate manually
docker compose exec certbot certbot renew

# View certbot logs
docker compose logs certbot
```

### Port Already in Use

**Problem**: Error like "Address already in use"

**Solutions**:
```bash
# Find process using port
lsof -i :80    # For port 80
lsof -i :443   # For port 443

# Stop conflicting services
sudo systemctl stop nginx
sudo systemctl stop apache2

# Or use different port in docker-compose.yml
```

### Disk Space Issues

**Problem**: Services running out of disk space

**Solutions**:
```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a
docker volume prune

# Remove old database backups
rm -f /backups/crm/backup_*.sql

# Check container logs size
docker compose logs --tail 100 backend
```

### Performance Issues

**Problem**: Application running slowly

**Solutions**:
1. **Increase resources**: Allocate more CPU/RAM to containers
2. **Database optimization**: Check for slow queries in backend logs
3. **Check database size**: `docker compose exec postgres psql -U postgres -d crm_db -c "SELECT pg_size_pretty(pg_database_size('crm_db'));"`
4. **Monitor logs**: `docker compose stats`

### User Locked Out

**Problem**: Can't log in or forgot password

**Solutions**:
1. Contact admin user
2. Reset via admin panel
3. As last resort, reset database and create new admin user

---

## Security Considerations

### Best Practices

1. **Change Default Credentials**: Set strong POSTGRES_PASSWORD
2. **Generate JWT_SECRET**: Use: `openssl rand -base64 48`
3. **Enable SSL/TLS**: Always use HTTPS in production
4. **Restrict CORS**: Set CORS_ORIGIN to your exact domain
5. **Regular Backups**: Implement automated backup strategy
6. **Update Images**: Regularly rebuild with latest base images
7. **Monitor Logs**: Review logs regularly for suspicious activity
8. **Firewall**: Use VPS firewall to restrict access

### Database Security

```bash
# Use strong password (generated in .env)
POSTGRES_PASSWORD=your_very_strong_password_here!

# Backup database regularly
docker compose exec postgres pg_dump -U postgres crm_db > backup.sql

# Restrict database access (already isolated in docker-network)
```

### Application Security

- JWT tokens expire after configured duration (default: 7 days)
- Passwords are encrypted
- CORS prevents unauthorized cross-origin requests
- Rate limiting on authentication endpoints

---

## Maintenance Tasks

### Daily

- Monitor disk space: `df -h`
- Check service health: `docker compose ps`
- Review error logs: `docker compose logs --tail 50`

### Weekly

- Backup database
- Review user activity in logs
- Check for available updates

### Monthly

- Update Docker images: `docker compose pull`
- Rebuild containers: `docker compose build`
- Full system restart: `docker compose restart`

### Quarterly

- Security audit
- Database optimization
- Performance review and tuning

---

## Support & Resources

- **Docker Docs**: https://docs.docker.com
- **Docker Compose**: https://docs.docker.com/compose
- **PostgreSQL Docs**: https://www.postgresql.org/docs
- **Let's Encrypt**: https://letsencrypt.org/docs
- **Nginx**: https://nginx.org/en/docs

---

**Last Updated**: July 2024  
**Version**: 1.0  
**For Issues**: Contact your system administrator
