# Quick VPS Recovery - Authentication Failed

## If you see this error:
```
Error: P1000: Authentication failed against database server at `127.0.0.1`
```

## Run this ONE command to fix it:

```bash
sudo bash /root/MuxroCRMCloud/fix-database-credentials.sh
```

This script will:
1. ✅ Verify PostgreSQL is running
2. ✅ Check if database exists
3. ✅ Check if user exists
4. ✅ Repair permissions
5. ✅ Test connection
6. ✅ Rebuild backend
7. ✅ Restart PM2
8. ✅ Verify all is working

## If that doesn't work, debug step-by-step:

### 1. Check PostgreSQL is running
```bash
sudo systemctl status postgresql
sudo systemctl start postgresql  # If not running
```

### 2. Check credentials in .env
```bash
cat /root/MuxroCRMCloud/backend/.env | grep DATABASE_URL
```

### 3. Test connection manually
```bash
# Replace PASSWORD with actual password from .env
PGPASSWORD="PASSWORD" psql -h 127.0.0.1 -U crm_user -d crm_db -c "SELECT 1"
```

If this works (shows "1"), your connection is OK.

### 4. If connection fails, reset the user
```bash
sudo -u postgres psql -c "ALTER USER crm_user WITH PASSWORD 'newpassword123';"
# Then update .env with the new password
sudo nano /root/MuxroCRMCloud/backend/.env
# Change: DATABASE_URL=postgresql://crm_user:newpassword123@127.0.0.1:5432/crm_db?schema=public
```

### 5. Rebuild and restart
```bash
cd /root/MuxroCRMCloud/backend
npm run build
npx prisma migrate deploy
pm2 restart muxro-crm-backend
```

## Common Issues

| Problem | Fix |
|---------|-----|
| "permission denied" | Run: `sudo bash fix-database-credentials.sh` |
| "user does not exist" | PostgreSQL crashed. Restart: `sudo systemctl restart postgresql` |
| "database does not exist" | Run setup again or recreate manually |
| "Connection refused" | PostgreSQL not running: `sudo systemctl start postgresql` |

## Quick validation

```bash
# All should show green
sudo bash /root/MuxroCRMCloud/production-audit.sh

# Check backend is running
pm2 status

# View logs if there are issues
pm2 logs muxro-crm-backend --lines 50
```
