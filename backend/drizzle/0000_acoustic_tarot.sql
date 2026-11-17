CREATE TYPE "public"."Role" AS ENUM('ADMIN', 'USER');--> statement-breakpoint
CREATE TABLE "CampaignStatus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaignId" uuid NOT NULL,
	"label" varchar(255) NOT NULL,
	"color" varchar(50) DEFAULT '#3B82F6' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"whatsappMessage" varchar(1000)
);
--> statement-breakpoint
CREATE TABLE "CampaignUser" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaignId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"assignedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Campaign" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"managerId" uuid
);
--> statement-breakpoint
CREATE TABLE "Enquiry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formId" uuid NOT NULL,
	"data" json NOT NULL,
	"submittedAt" timestamp DEFAULT now() NOT NULL,
	"ipAddress" varchar(45)
);
--> statement-breakpoint
CREATE TABLE "Followup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leadId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"status" varchar(255) NOT NULL,
	"remarks" varchar(1000),
	"nextCallDate" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Form" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaignId" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"fields" json DEFAULT '[]'::json,
	"isPublished" boolean DEFAULT false NOT NULL,
	"publicSlug" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Form_publicSlug_unique" UNIQUE("publicSlug")
);
--> statement-breakpoint
CREATE TABLE "JobLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobType" varchar(100) NOT NULL,
	"jobId" varchar(255),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"payload" json,
	"result" json,
	"error" text,
	"retryCount" integer DEFAULT 0 NOT NULL,
	"maxRetries" integer DEFAULT 3 NOT NULL,
	"idempotencyKey" varchar(255),
	"startedAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Lead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaignId" uuid NOT NULL,
	"enquiryId" uuid,
	"indiamartQueryId" varchar(255),
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"source" varchar(100) DEFAULT 'manual' NOT NULL,
	"customData" json,
	"dnd" boolean DEFAULT false NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"deletedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"doerId" uuid,
	"statusId" uuid,
	CONSTRAINT "Lead_enquiryId_unique" UNIQUE("enquiryId"),
	CONSTRAINT "Lead_indiamartQueryId_unique" UNIQUE("indiamartQueryId")
);
--> statement-breakpoint
CREATE TABLE "Notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"followupId" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "OutboxEvent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregateType" varchar(100) NOT NULL,
	"aggregateId" varchar(255) NOT NULL,
	"eventType" varchar(100) NOT NULL,
	"payload" json NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"publishedAt" timestamp,
	"retryCount" integer DEFAULT 0 NOT NULL,
	"maxRetries" integer DEFAULT 3 NOT NULL,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RefreshSession" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"tokenHash" varchar(255) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"revokedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "RefreshSession_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "SettingAuditLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settingId" uuid NOT NULL,
	"action" varchar(50) DEFAULT 'update' NOT NULL,
	"changedBy" varchar(255),
	"oldValue" varchar(2000),
	"newValue" varchar(2000),
	"reason" varchar(500),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Setting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"encryptedValue" varchar(2000) NOT NULL,
	"isEncrypted" boolean DEFAULT true NOT NULL,
	"lastTestedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Setting_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"role" "Role" DEFAULT 'USER' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "User_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "CampaignStatus" ADD CONSTRAINT "CampaignStatus_campaignId_Campaign_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CampaignUser" ADD CONSTRAINT "CampaignUser_campaignId_Campaign_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CampaignUser" ADD CONSTRAINT "CampaignUser_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_managerId_User_id_fk" FOREIGN KEY ("managerId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_formId_Form_id_fk" FOREIGN KEY ("formId") REFERENCES "public"."Form"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Followup" ADD CONSTRAINT "Followup_leadId_Lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Followup" ADD CONSTRAINT "Followup_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Form" ADD CONSTRAINT "Form_campaignId_Campaign_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_Campaign_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_enquiryId_Enquiry_id_fk" FOREIGN KEY ("enquiryId") REFERENCES "public"."Enquiry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_doerId_User_id_fk" FOREIGN KEY ("doerId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_statusId_CampaignStatus_id_fk" FOREIGN KEY ("statusId") REFERENCES "public"."CampaignStatus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_followupId_Followup_id_fk" FOREIGN KEY ("followupId") REFERENCES "public"."Followup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SettingAuditLog" ADD CONSTRAINT "SettingAuditLog_settingId_Setting_id_fk" FOREIGN KEY ("settingId") REFERENCES "public"."Setting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "CampaignStatus_campaignId_idx" ON "CampaignStatus" USING btree ("campaignId");--> statement-breakpoint
CREATE UNIQUE INDEX "CampaignUser_campaignId_userId_key" ON "CampaignUser" USING btree ("campaignId","userId");--> statement-breakpoint
CREATE INDEX "CampaignUser_campaignId_idx" ON "CampaignUser" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "CampaignUser_userId_idx" ON "CampaignUser" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "CampaignUser_isActive_idx" ON "CampaignUser" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "Campaign_managerId_idx" ON "Campaign" USING btree ("managerId");--> statement-breakpoint
CREATE INDEX "Campaign_isActive_idx" ON "Campaign" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "Enquiry_formId_submittedAt_idx" ON "Enquiry" USING btree ("formId","submittedAt");--> statement-breakpoint
CREATE INDEX "Enquiry_submittedAt_idx" ON "Enquiry" USING btree ("submittedAt");--> statement-breakpoint
CREATE INDEX "Followup_leadId_idx" ON "Followup" USING btree ("leadId");--> statement-breakpoint
CREATE INDEX "Followup_userId_idx" ON "Followup" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Followup_nextCallDate_idx" ON "Followup" USING btree ("nextCallDate");--> statement-breakpoint
CREATE INDEX "Followup_createdAt_idx" ON "Followup" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Followup_userId_nextCallDate_idx" ON "Followup" USING btree ("userId","nextCallDate");--> statement-breakpoint
CREATE INDEX "Form_campaignId_idx" ON "Form" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "Form_isPublished_idx" ON "Form" USING btree ("isPublished");--> statement-breakpoint
CREATE INDEX "JobLog_jobType_idx" ON "JobLog" USING btree ("jobType");--> statement-breakpoint
CREATE INDEX "JobLog_status_idx" ON "JobLog" USING btree ("status");--> statement-breakpoint
CREATE INDEX "JobLog_idempotencyKey_idx" ON "JobLog" USING btree ("idempotencyKey");--> statement-breakpoint
CREATE INDEX "JobLog_createdAt_idx" ON "JobLog" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Lead_campaignId_idx" ON "Lead" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "Lead_doerId_idx" ON "Lead" USING btree ("doerId");--> statement-breakpoint
CREATE INDEX "Lead_statusId_idx" ON "Lead" USING btree ("statusId");--> statement-breakpoint
CREATE INDEX "Lead_source_idx" ON "Lead" USING btree ("source");--> statement-breakpoint
CREATE INDEX "Lead_dnd_idx" ON "Lead" USING btree ("dnd");--> statement-breakpoint
CREATE INDEX "Lead_name_idx" ON "Lead" USING btree ("name");--> statement-breakpoint
CREATE INDEX "Lead_phone_idx" ON "Lead" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "Lead_email_idx" ON "Lead" USING btree ("email");--> statement-breakpoint
CREATE INDEX "Lead_createdAt_idx" ON "Lead" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Lead_updatedAt_idx" ON "Lead" USING btree ("updatedAt");--> statement-breakpoint
CREATE INDEX "Lead_campaignId_doerId_idx" ON "Lead" USING btree ("campaignId","doerId");--> statement-breakpoint
CREATE INDEX "Lead_campaignId_statusId_idx" ON "Lead" USING btree ("campaignId","statusId");--> statement-breakpoint
CREATE INDEX "Lead_doerId_dnd_idx" ON "Lead" USING btree ("doerId","dnd");--> statement-breakpoint
CREATE INDEX "Lead_isDeleted_idx" ON "Lead" USING btree ("isDeleted");--> statement-breakpoint
CREATE UNIQUE INDEX "Notification_userId_followupId_key" ON "Notification" USING btree ("userId","followupId");--> statement-breakpoint
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification" USING btree ("userId","isRead");--> statement-breakpoint
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "Notification_type_idx" ON "Notification" USING btree ("type");--> statement-breakpoint
CREATE INDEX "OutboxEvent_published_idx" ON "OutboxEvent" USING btree ("published");--> statement-breakpoint
CREATE INDEX "OutboxEvent_eventType_idx" ON "OutboxEvent" USING btree ("eventType");--> statement-breakpoint
CREATE INDEX "OutboxEvent_createdAt_idx" ON "OutboxEvent" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent" USING btree ("aggregateType","aggregateId");--> statement-breakpoint
CREATE INDEX "OutboxEvent_published_retryCount_maxRetries_idx" ON "OutboxEvent" USING btree ("published","retryCount","maxRetries");--> statement-breakpoint
CREATE INDEX "RefreshSession_userId_idx" ON "RefreshSession" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "RefreshSession_tokenHash_idx" ON "RefreshSession" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "RefreshSession_expiresAt_idx" ON "RefreshSession" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "SettingAuditLog_settingId_idx" ON "SettingAuditLog" USING btree ("settingId");--> statement-breakpoint
CREATE INDEX "SettingAuditLog_createdAt_idx" ON "SettingAuditLog" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Setting_updatedAt_idx" ON "Setting" USING btree ("updatedAt");--> statement-breakpoint
CREATE INDEX "User_role_idx" ON "User" USING btree ("role");--> statement-breakpoint
CREATE INDEX "User_isActive_idx" ON "User" USING btree ("isActive");