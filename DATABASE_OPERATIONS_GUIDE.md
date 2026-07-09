# PostgreSQL Database Setup & Operations Guide
**MUXRO CRM Database Operations Manual**  
**Date:** 2026-07-09  
**Database:** PostgreSQL 15 + Drizzle ORM

---

## 1. INITIAL DATABASE SETUP

### 1.1 Docker Compose (Recommended - Fastest)

```bash
# 1. Clone repository
git clone https://github.com/jating0000la/MuxroCRMCloud.git
cd MuxroCRMCloud

# 2. Create environment file
cp .env.example .env

# 3. Edit .env with your configuration
nano .env

# 4. Start PostgreSQL container
docker-compose up postgres -d

# 5. Verify PostgreSQL is running
docker ps | grep postgres

# 6. Check database health
docker-compose exec postgres pg_isready -U postgres

# 7. Backend will auto-create schema on startup
docker-compose up -d

# 8. Verify schema creation
docker-compose exec postgres psql -U postgres -d crm_db -c "\dt"
```

### 1.2 VPS/Local PostgreSQL Setup (Manual)

#### Ubuntu/Debian Installation
```bash
# 1. Update package manager
sudo apt update

# 2. Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# 3. Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 4. Create database
sudo -u postgres createdb crm_db

# 5. Create application user
sudo -u postgres createuser crm_user

# 6. Set password
sudo -u postgres psql -c "ALTER USER crm_user WITH PASSWORD 'strong_password_here';"

# 7. Grant permissions
sudo -u postgres psql <<EOF
ALTER SCHEMA public OWNER TO crm_user;
GRANT CONNECT ON DATABASE crm_db TO crm_user;
GRANT USAGE ON SCHEMA public TO crm_user;
GRANT CREATE ON SCHEMA public TO crm_user;
EOF

# 8. Configure connection string
export DATABASE_URL="postgresql://crm_user:strong_password_here@localhost:5432/crm_db"

# 9. Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

#### macOS Installation (Homebrew)
```bash
# 1. Install PostgreSQL
brew install postgresql@15

# 2. Start PostgreSQL
brew services start postgresql@15

# 3. Create database and user
createdb crm_db
createuser crm_user

# 4. Set password
psql -U postgres -c "ALTER USER crm_user WITH PASSWORD 'password';"

# 5. Export connection string
export DATABASE_URL="postgresql://crm_user:password@localhost:5432/crm_db"
```

#### Windows Installation
```powershell
# Download from https://www.postgresql.org/download/windows/
# Run installer
# Select default port 5432
# Remember postgres password

# Connect to PostgreSQL
psql -U postgres

# In psql shell:
CREATE DATABASE crm_db;
CREATE USER crm_user WITH PASSWORD 'password';
ALTER SCHEMA public OWNER TO crm_user;
GRANT ALL PRIVILEGES ON DATABASE crm_db TO crm_user;
\q

# Set environment variable
$env:DATABASE_URL = "postgresql://crm_user:password@localhost:5432/crm_db"
```

---

## 2. SCHEMA DEPLOYMENT

### 2.1 Deploy Schema with Drizzle ORM

```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Deploy schema to database
npm run db:push

# 4. Verify tables created
psql $DATABASE_URL -c "\dt"

# Expected output:
# Schema | Name | Type | Owner
# --------|------|------|----------
# public | User | table | crm_user
# public | Campaign | table | crm_user
# ... (11 tables total)
```

### 2.2 Seed Initial Data

```bash
# 1. Run seed script
npm run db:seed

# 2. Verify data created
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"User\";"

# Expected: 2 (admin + default user)
```

### 2.3 Verify Schema Structure

```bash
# Check all tables
psql $DATABASE_URL -c "\dt"

# Check specific table
psql $DATABASE_URL -c "\d \"User\""

# Check indexes
psql $DATABASE_URL -c "\di"

# Check database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('crm_db'));"
```

---

## 3. CONNECTION STRING CONFIGURATION

### 3.1 Format
```
postgresql://username:password@host:port/database?parameters
```

### 3.2 Examples

**Docker (internal):**
```
postgresql://postgres:postgres@postgres:5432/crm_db?schema=public
```

**Local Development:**
```
postgresql://crm_user:password@localhost:5432/crm_db?schema=public
```

**VPS/Production:**
```
postgresql://crm_user:strong_password@127.0.0.1:5432/crm_db?schema=public&connection_limit=5
```

**With SSL (Production):**
```
postgresql://crm_user:password@host:5432/crm_db?sslmode=require&schema=public
```

### 3.3 Connection Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| schema | public | Default schema |
| connection_limit | 5 | Max connections per pool |
| sslmode | require | Force SSL connection |
| application_name | crm-backend | Identify connections |
| statement_timeout | 30000 | Query timeout (ms) |

---

## 4. BACKUP & RESTORE

### 4.1 Create Backup

#### Full Database Backup
```bash
# Docker backup
docker exec crm-postgres pg_dump -U postgres crm_db > crm_db_backup.sql

# Local backup
pg_dump -U crm_user -h localhost -d crm_db > crm_db_backup.sql

# Compressed backup (recommended)
pg_dump -U crm_user -d crm_db | gzip > crm_db_backup.sql.gz

# With verbose output
pg_dump -U crm_user -d crm_db -v > crm_db_backup.sql
```

#### Selective Backup (Schema Only)
```bash
# Schema without data
pg_dump -U crm_user -d crm_db --schema-only > crm_db_schema.sql

# Specific table only
pg_dump -U crm_user -d crm_db -t "User" > crm_users_table.sql
```

### 4.2 Restore Backup

#### Full Restore
```bash
# Drop existing database
psql -U postgres -c "DROP DATABASE crm_db;"

# Recreate database
psql -U postgres -c "CREATE DATABASE crm_db OWNER crm_user;"

# Restore from SQL
psql -U postgres -d crm_db < crm_db_backup.sql

# Restore from compressed
zcat crm_db_backup.sql.gz | psql -U postgres -d crm_db
```

#### Point-in-Time Recovery (if using WAL)
```bash
# Set up WAL archiving in postgresql.conf:
archive_mode = on
archive_command = 'cp %p /backup/wal_archive/%f'

# Restore to specific point in time
pg_restore -U postgres -d crm_db --recovery-target-timeline=latest --recovery-target-time='2026-07-09 12:00:00'
```

### 4.3 Backup Automation

#### Linux Cron Job
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * pg_dump -U crm_user -h localhost -d crm_db | gzip > /backup/crm_db_$(date +\%Y\%m\%d).sql.gz

# Verify daily (add another cron at 3 AM)
0 3 * * * pg_isready -U crm_user -h localhost || echo "Backup failed"
```

#### Docker Backup Script
```bash
#!/bin/bash
# backup-crm-db.sh

BACKUP_DIR="/backup"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/crm_db_$DATE.sql.gz"

mkdir -p $BACKUP_DIR

docker exec crm-postgres pg_dump -U postgres crm_db | \
  gzip > $BACKUP_FILE

echo "Backup created: $BACKUP_FILE"

# Keep only last 7 days
find $BACKUP_DIR -name "crm_db_*.sql.gz" -mtime +7 -delete
```

### 4.4 Backup Verification

```bash
# Test restore in new database
createdb crm_db_test

# Restore backup
pg_restore -U postgres -d crm_db_test < crm_db_backup.sql

# Verify table count matches
psql -U postgres -d crm_db_test -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"

# Cleanup test database
dropdb crm_db_test
```

---

## 5. PERFORMANCE TUNING

### 5.1 Monitor Connection Usage

```bash
# Check active connections
psql $DATABASE_URL -c "SELECT pid, client_addr, state FROM pg_stat_activity;"

# Count connections by state
psql $DATABASE_URL -c "SELECT state, COUNT(*) FROM pg_stat_activity GROUP BY state;"

# Check connection limits
psql $DATABASE_URL -c "SHOW max_connections;"

# Find idle connections (close if needed)
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state='idle' AND query_start < now() - interval '10 minutes';"
```

### 5.2 Monitor Query Performance

```bash
# Slow query log (if enabled)
psql $DATABASE_URL -c "SELECT query, mean_exec_time, calls FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Check query cache hit ratio
psql $DATABASE_URL -c "SELECT sum(heap_blks_read) as heap_read, sum(heap_blks_hit) as heap_hit, sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio FROM pg_statio_user_tables;"

# Find inefficient queries
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM \"Lead\" WHERE \"campaignId\" = 'id';"
```

### 5.3 Optimize Indexes

```bash
# Check index usage
psql $DATABASE_URL -c "SELECT schemaname, tablename, indexname, idx_scan FROM pg_stat_user_indexes ORDER BY idx_scan DESC;"

# Find unused indexes
psql $DATABASE_URL -c "SELECT schemaname, tablename, indexname FROM pg_stat_user_indexes WHERE idx_scan = 0;"

# Remove unused index
psql $DATABASE_URL -c "DROP INDEX IF EXISTS index_name;"

# Rebuild fragmented indexes
psql $DATABASE_URL -c "REINDEX INDEX index_name;"

# Analyze query plan
psql $DATABASE_URL -c "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM \"Lead\" WHERE \"doerId\" = 'user-id';"
```

### 5.4 Database Maintenance

```bash
# Vacuum (reclaim space)
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Analyze (update statistics)
psql $DATABASE_URL -c "ANALYZE;"

# Full maintenance (maintenance window needed)
psql $DATABASE_URL -c "VACUUM FULL ANALYZE;"

# Check table bloat
psql $DATABASE_URL -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY pg_total_relation_size DESC;"
```

---

## 6. TROUBLESHOOTING

### 6.1 Connection Issues

**Problem: "Connection refused"**
```bash
# Check if PostgreSQL is running
systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Check port 5432 is listening
sudo netstat -tulpn | grep 5432

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

**Problem: "Password authentication failed"**
```bash
# Verify user exists
psql -U postgres -c "\du crm_user"

# Reset password
sudo -u postgres psql -c "ALTER USER crm_user WITH PASSWORD 'newpassword';"

# Check pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf
# Should have: local all all md5
```

**Problem: "Connection pool exhausted"**
```bash
# Check open connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='idle' AND state_change < now() - interval '5 minutes';"

# Increase connection pool (edit Drizzle config)
DATABASE_POOL_MAX=10
```

### 6.2 Data Issues

**Problem: "Duplicate key value"**
```bash
# Check for duplicates
psql $DATABASE_URL -c "SELECT username, COUNT(*) FROM \"User\" GROUP BY username HAVING COUNT(*) > 1;"

# If found, view the duplicates
psql $DATABASE_URL -c "SELECT * FROM \"User\" WHERE username = 'duplicate_username';"

# Remove duplicate (keep first)
psql $DATABASE_URL -c "DELETE FROM \"User\" WHERE id NOT IN (SELECT min(id) FROM \"User\" GROUP BY username);"
```

**Problem: "Foreign key constraint violated"**
```bash
# Check constraints
psql $DATABASE_URL -c "SELECT constraint_name, table_name FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY';"

# View constraint details
psql $DATABASE_URL -c "\d \"Lead\"" | grep campaign

# Find orphaned records
psql $DATABASE_URL -c "SELECT * FROM \"Lead\" WHERE \"campaignId\" NOT IN (SELECT id FROM \"Campaign\");"

# Fix: Delete orphaned records
psql $DATABASE_URL -c "DELETE FROM \"Lead\" WHERE \"campaignId\" NOT IN (SELECT id FROM \"Campaign\");"
```

**Problem: "Out of disk space"**
```bash
# Check database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('crm_db'));"

# Check table sizes
psql $DATABASE_URL -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY pg_total_relation_size DESC;"

# Cleanup options:
# 1. Archive old data
psql $DATABASE_URL -c "DELETE FROM \"Lead\" WHERE \"createdAt\" < now() - interval '1 year';"

# 2. Vacuum
psql $DATABASE_URL -c "VACUUM FULL ANALYZE;"

# 3. Expand disk (depends on infrastructure)
```

### 6.3 Performance Issues

**Slow Queries:**
```bash
# Get slow query log (requires setup)
tail -f /var/log/postgresql/postgresql-15-main-slow.log

# Or query pg_stat_statements
psql $DATABASE_URL -c "SELECT query, mean_exec_time, calls FROM pg_stat_statements WHERE mean_exec_time > 1000 ORDER BY mean_exec_time DESC;"

# Optimize with indexes
psql $DATABASE_URL -c "CREATE INDEX idx_lead_campaign_doer ON \"Lead\"(\"campaignId\", \"doerId\");"
```

**High Memory Usage:**
```bash
# Check cache size
psql $DATABASE_URL -c "SHOW shared_buffers;"

# Check current memory
ps aux | grep postgres

# Reduce memory usage
# Edit postgresql.conf:
shared_buffers = 128MB
work_mem = 4MB
maintenance_work_mem = 64MB
```

---

## 7. MAINTENANCE SCHEDULE

### Daily
- [ ] Check PostgreSQL is running: `systemctl status postgresql`
- [ ] Monitor connection count: `SELECT count(*) FROM pg_stat_activity;`
- [ ] Check error logs: `tail -f /var/log/postgresql/postgresql-15-main.log`

### Weekly
- [ ] Create backup: `bash backup-crm-db.sh`
- [ ] Analyze slow queries: `SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 5;`
- [ ] Check disk usage: `df -h | grep postgresql`
- [ ] Verify backup integrity: Restore test copy

### Monthly
- [ ] Full maintenance window
  ```bash
  psql $DATABASE_URL -c "VACUUM FULL ANALYZE;"
  ```
- [ ] Review connection pool usage
- [ ] Optimize indexes if needed
- [ ] Test disaster recovery (restore from backup)

### Quarterly
- [ ] PostgreSQL security updates
- [ ] Review performance metrics trends
- [ ] Archive old data if applicable
- [ ] Capacity planning review

---

## 8. DRIZZLE ORM COMMANDS

### Development

```bash
# Generate migration from schema changes
npm run db:generate

# Apply pending migrations
npm run db:migrate

# Sync schema with database
npm run db:push

# Open visual database editor
npm run db:studio

# Seed initial data
npm run db:seed
```

### Production

```bash
# Apply migrations (CI/CD)
npm run db:migrate

# Or sync schema (simpler approach)
npm run db:push

# Verify schema
psql $DATABASE_URL -c "\dt"
```

---

## 9. QUICK REFERENCE

### Common Commands

```bash
# Connect to database
psql $DATABASE_URL

# List tables
\dt

# Describe table
\d "TableName"

# List indexes
\di

# Exit psql
\q

# Run SQL file
\i /path/to/file.sql

# Get table row count
SELECT COUNT(*) FROM table_name;

# Get database size
SELECT pg_size_pretty(pg_database_size('crm_db'));

# Kill idle connections
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='idle';

# Backup
pg_dump -U crm_user -d crm_db | gzip > backup.sql.gz

# Restore
zcat backup.sql.gz | psql -U crm_user -d crm_db
```

### Environment Variables

```bash
DATABASE_URL="postgresql://user:pass@host:port/db"
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=5
DATABASE_IDLE_TIMEOUT=30000
DATABASE_STATEMENT_TIMEOUT=30000
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-09  
**PostgreSQL Version:** 15.x  
**Drizzle ORM:** 0.45.2+

For additional help, see [DRIZZLE_ORM_AUDIT.md](DRIZZLE_ORM_AUDIT.md)
