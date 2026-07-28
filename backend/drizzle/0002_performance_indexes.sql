-- Performance optimization indexes
-- Migration: 0002_performance_indexes.sql
--
-- These composite indexes support the most common query patterns:
--   1. Followup list queries filtered by userId + ordered by createdAt DESC (keyset pagination)
--   2. Lateral join subquery in dashboard (latest followup per lead)
--   3. Followup upcoming queries filtered by userId + nextCallDate

-- (1) Composite index for getMyFollowups keyset pagination.
--     The query filters: followups."userId" = ? AND campaigns."isActive" = true
--     and orders by followups."createdAt" DESC (with cursor: createdAt < ?).
--     A covering index on (userId, createdAt DESC) lets PostgreSQL seek directly.
CREATE INDEX IF NOT EXISTS "Followup_userId_createdAt_idx"
  ON "Followup" ("userId", "createdAt" DESC);

-- (2) Composite index for the LATERAL subquery in dashboard service:
--     SELECT ... FROM "Followup" WHERE "leadId" = ? ORDER BY "createdAt" DESC LIMIT 1
--     Without this index PostgreSQL would need a full sort per lead row.
CREATE INDEX IF NOT EXISTS "Followup_leadId_createdAt_idx"
  ON "Followup" ("leadId", "createdAt" DESC);

-- (3) Composite index for the upcoming-followups query that also filters DND.
--     The dashboard getFollowupDashboard / getKpiOverview joins
--     leads with followups and filters on leads."isDeleted" + leads."doerId".
--     A composite index helps the join + filter.
CREATE INDEX IF NOT EXISTS "Lead_isDeleted_doerId_idx"
  ON "Lead" ("isDeleted", "doerId")
  WHERE "isDeleted" = false;

-- (4) Composite index covering the common dashboard lead-list query:
--     WHERE "isDeleted" = false AND "campaignId" = ? AND ("doerId" = ?)
CREATE INDEX IF NOT EXISTS "Lead_list_query_idx"
  ON "Lead" ("campaignId", "doerId")
  WHERE "isDeleted" = false;
