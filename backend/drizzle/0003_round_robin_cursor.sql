CREATE TABLE IF NOT EXISTS "RoundRobinCursor" (
  "campaignId" uuid PRIMARY KEY REFERENCES "Campaign"("id") ON DELETE CASCADE,
  "userId" uuid REFERENCES "User"("id") ON DELETE SET NULL
);
