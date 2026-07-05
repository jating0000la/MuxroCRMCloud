-- CreateIndex
CREATE INDEX "Campaign_managerId_idx" ON "Campaign"("managerId");

-- CreateIndex
CREATE INDEX "Campaign_isActive_idx" ON "Campaign"("isActive");

-- CreateIndex
CREATE INDEX "CampaignStatus_campaignId_idx" ON "CampaignStatus"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignUser_campaignId_idx" ON "CampaignUser"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignUser_userId_idx" ON "CampaignUser"("userId");

-- CreateIndex
CREATE INDEX "CampaignUser_isActive_idx" ON "CampaignUser"("isActive");

-- CreateIndex
CREATE INDEX "Enquiry_formId_idx" ON "Enquiry"("formId");

-- CreateIndex
CREATE INDEX "Enquiry_submittedAt_idx" ON "Enquiry"("submittedAt");

-- CreateIndex
CREATE INDEX "Followup_leadId_idx" ON "Followup"("leadId");

-- CreateIndex
CREATE INDEX "Followup_userId_idx" ON "Followup"("userId");

-- CreateIndex
CREATE INDEX "Followup_nextCallDate_idx" ON "Followup"("nextCallDate");

-- CreateIndex
CREATE INDEX "Followup_createdAt_idx" ON "Followup"("createdAt");

-- CreateIndex
CREATE INDEX "Followup_userId_nextCallDate_idx" ON "Followup"("userId", "nextCallDate");

-- CreateIndex
CREATE INDEX "Form_campaignId_idx" ON "Form"("campaignId");

-- CreateIndex
CREATE INDEX "Form_isPublished_idx" ON "Form"("isPublished");

-- CreateIndex
CREATE INDEX "Lead_campaignId_idx" ON "Lead"("campaignId");

-- CreateIndex
CREATE INDEX "Lead_doerId_idx" ON "Lead"("doerId");

-- CreateIndex
CREATE INDEX "Lead_statusId_idx" ON "Lead"("statusId");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");

-- CreateIndex
CREATE INDEX "Lead_dnd_idx" ON "Lead"("dnd");

-- CreateIndex
CREATE INDEX "Lead_name_idx" ON "Lead"("name");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_updatedAt_idx" ON "Lead"("updatedAt");

-- CreateIndex
CREATE INDEX "Lead_campaignId_doerId_idx" ON "Lead"("campaignId", "doerId");

-- CreateIndex
CREATE INDEX "Lead_campaignId_statusId_idx" ON "Lead"("campaignId", "statusId");

-- CreateIndex
CREATE INDEX "Lead_doerId_dnd_idx" ON "Lead"("doerId", "dnd");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
