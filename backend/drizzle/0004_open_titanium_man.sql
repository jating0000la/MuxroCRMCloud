CREATE TABLE "IvrCall" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenantId" varchar(30) NOT NULL,
	"externalCallId" varchar(128) NOT NULL,
	"providerCallId" varchar(128) NOT NULL,
	"crmCampaignId" uuid NOT NULL,
	"leadId" uuid NOT NULL,
	"phone" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"answered" boolean DEFAULT false NOT NULL,
	"callbackNeeded" boolean DEFAULT false NOT NULL,
	"agentId" varchar(30),
	"operatorName" varchar(100),
	"receivedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastEventAt" timestamp with time zone DEFAULT now() NOT NULL,
	"endedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "IvrWebhookEvent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eventKey" varchar(64) NOT NULL,
	"tenantId" varchar(30) NOT NULL,
	"externalCallId" varchar(128) NOT NULL,
	"crmCampaignId" uuid NOT NULL,
	"payload" json NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" varchar(255),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"processedAt" timestamp with time zone,
	"nextAttemptAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "IvrWebhookEvent_eventKey_unique" UNIQUE("eventKey")
);
--> statement-breakpoint
ALTER TABLE "IvrCall" ADD CONSTRAINT "IvrCall_crmCampaignId_Campaign_id_fk" FOREIGN KEY ("crmCampaignId") REFERENCES "public"."Campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "IvrCall" ADD CONSTRAINT "IvrCall_leadId_Lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "IvrWebhookEvent" ADD CONSTRAINT "IvrWebhookEvent_crmCampaignId_Campaign_id_fk" FOREIGN KEY ("crmCampaignId") REFERENCES "public"."Campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "IvrCall_tenant_external_key" ON "IvrCall" USING btree ("tenantId","externalCallId");--> statement-breakpoint
CREATE INDEX "IvrCall_lead_received_idx" ON "IvrCall" USING btree ("leadId","receivedAt");--> statement-breakpoint
CREATE INDEX "IvrWebhookEvent_pending_idx" ON "IvrWebhookEvent" USING btree ("status","nextAttemptAt");