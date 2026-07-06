-- CreateIndex for optimized queries on 2GB VPS
-- These composite indexes speed up common filter patterns

-- Lead queries: campaign + status filtering
CREATE INDEX IF NOT EXISTS idx_lead_campaign_status 
ON "Lead"(campaignId, statusId) 
WHERE "dnd" = false;

-- Lead queries: campaign + doer (assignee) filtering
CREATE INDEX IF NOT EXISTS idx_lead_campaign_doer 
ON "Lead"(campaignId, doerId) 
WHERE "dnd" = false;

-- Follow-up queries: user + date filtering (for next calls)
CREATE INDEX IF NOT EXISTS idx_followup_user_date 
ON "Followup"(userId, "nextCallDate" DESC NULLS LAST);

-- Follow-up queries: lead + creation time
CREATE INDEX IF NOT EXISTS idx_followup_lead_created 
ON "Followup"(leadId, "createdAt" DESC);

-- Search optimization: campaign + name text search
CREATE INDEX IF NOT EXISTS idx_lead_name_campaign 
ON "Lead"(campaignId, name) 
WHERE "dnd" = false;

-- Phone number search
CREATE INDEX IF NOT EXISTS idx_lead_phone 
ON "Lead"(phone) 
WHERE phone IS NOT NULL;

-- Campaign user queries
CREATE INDEX IF NOT EXISTS idx_campaign_user_active 
ON "CampaignUser"(campaignId, userId) 
WHERE "isActive" = true;

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_lead_created_campaign 
ON "Lead"("createdAt" DESC, campaignId);

-- DND tracking queries
CREATE INDEX IF NOT EXISTS idx_lead_dnd_campaign 
ON "Lead"(campaignId, "dnd");

-- Enquiry queries
CREATE INDEX IF NOT EXISTS idx_enquiry_form_submitted 
ON "Enquiry"(formId, "submittedAt" DESC);
