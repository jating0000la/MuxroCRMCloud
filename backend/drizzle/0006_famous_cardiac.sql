CREATE TABLE "GupshupTemplate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appId" varchar(255) NOT NULL,
	"templateId" varchar(255) NOT NULL,
	"content" json NOT NULL,
	"syncedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "CampaignStatus" ADD COLUMN "whatsappTemplate" json;--> statement-breakpoint
ALTER TABLE "WhatsappMessage" ADD COLUMN "automationKey" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "GupshupTemplate_app_template_key" ON "GupshupTemplate" USING btree ("appId","templateId");--> statement-breakpoint
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_automationKey_unique" UNIQUE("automationKey");