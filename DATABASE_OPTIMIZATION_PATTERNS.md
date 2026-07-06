# Database Optimization - Query Patterns Reference

## Quick Query Pattern Examples

### Pattern 1: Adding Pagination to Services

```typescript
// BEFORE: No pagination (slow, high memory)
async findByCampaign(campaignId: string) {
  return this.prisma.lead.findMany({
    where: { campaignId },
    include: { doer: true, status: true }
  });
}

// AFTER: With pagination (fast, low memory)
async findByCampaign(campaignId: string, page = 1, limit = 25) {
  const { skip } = parsePagination({ page, limit });
  
  const [leads, total] = await Promise.all([
    this.prisma.lead.findMany({
      where: { campaignId },
      select: {
        id: true, name: true, email: true, doerId: true, statusId: true,
        doer: { select: { id: true, name: true } },
        status: { select: { id: true, label: true } }
      },
      skip, take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    this.prisma.lead.count({ where: { campaignId } })
  ]);

  return createPaginatedResponse(leads, total, { page, limit });
}
```

### Pattern 2: Optimize Dashboard Queries

```typescript
// BEFORE: Multiple separate calls
async getDashboardStats(campaignId: string) {
  const total = await this.prisma.lead.count({ where: { campaignId } });
  const statuses = await this.prisma.campaignStatus.findMany({
    where: { campaignId },
    include: { _count: { select: { leads: true } } }
  });
  return { total, statuses };
}

// AFTER: Parallel batched queries
async getDashboardStats(campaignId: string) {
  const [total, statuses] = await Promise.all([
    this.prisma.lead.count({ where: { campaignId } }),
    this.prisma.campaignStatus.findMany({
      where: { campaignId },
      select: { id: true, label: true, _count: { select: { leads: true } } }
    })
  ]);
  return { total, statuses };
}
```

### Pattern 3: Use select for Only Needed Fields

```typescript
// BEFORE: Fetches all fields then filters
include: {
  doer: true,           // Gets all user fields
  status: true,         // Gets all status fields
  followups: true       // Gets all followup records
}

// AFTER: Only needed fields
select: {
  id: true,
  name: true,
  email: true,
  doer: { select: { id: true, name: true } },           // Only 2 fields
  status: { select: { id: true, label: true } },        // Only 2 fields
  followups: {
    select: { id: true, status: true },
    take: 5,
    orderBy: { createdAt: 'desc' }
  }
}
```

## Services Needing Updates

### 1. LeadsService
- [ ] `findByCampaign()` - Add pagination
- [ ] `findAll()` - Add pagination  
- [ ] `search()` - Add pagination with search term

### 2. FollowupsService
- [ ] `findByUser()` - Add pagination
- [ ] `findByCampaign()` - Add pagination
- [ ] `getUpcoming()` - Add pagination

### 3. DashboardService
- [ ] `getAllLeadsDashboard()` - Add pagination
- [ ] `getFollowupDashboard()` - Add pagination
- [ ] Use `Promise.all()` to batch queries

### 4. UsersService
- [ ] `findAll()` - Add pagination
- [ ] Admin users list - Optimize query

### 5. CampaignsService
- [ ] `findByManager()` - Add pagination if needed

## Installation: Apply Indexes

```bash
# SSH into VPS
ssh root@your-vps-ip

# Navigate to project
cd /path/to/crm

# Apply migration
docker-compose exec backend npx prisma migrate deploy

# Verify indexes created
docker-compose exec postgres psql -U postgres -d crm_db -c "\di"
```

## Verification: Check Query Performance

```bash
# Check slow queries
docker-compose exec postgres psql -U postgres -d crm_db -c "
SELECT query, mean_exec_time FROM pg_stat_statements 
WHERE mean_exec_time > 100 
ORDER BY mean_exec_time DESC LIMIT 10;"

# Check connection usage
docker-compose exec postgres psql -U postgres -d crm_db -c "
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"

# Check database size
docker-compose exec postgres psql -U postgres -d crm_db -c "
SELECT pg_size_pretty(pg_database_size(current_database()));"
```

## Monitoring: Enable Query Logging

```bash
# Enable slow query log (1 second threshold)
docker-compose exec postgres psql -U postgres -d crm_db -c "
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();"

# View slow queries
docker-compose exec postgres tail -f /var/log/postgresql/postgresql.log | grep duration
```

## Performance Gains Timeline

| After Step | Load Time | Memory | Concurrent |
|-----------|-----------|--------|-----------|
| Current | 3-5s | 75% | 5-8 users |
| + Indexes | 2-3s | 70% | 8-12 users |
| + Pagination | 800ms | 60% | 10-12 users |
| + Caching | 200ms | 55% | 12-15 users |

## Estimated Total Improvement: **4-6x performance increase**
