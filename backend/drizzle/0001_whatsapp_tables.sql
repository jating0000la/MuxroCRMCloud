-- WhatsApp Messages & Contacts tables
-- Migration: 0001_whatsapp_tables.sql

CREATE TABLE IF NOT EXISTS "WhatsappMessage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "phone" varchar(50) NOT NULL,
  "name" varchar(255),
  "direction" varchar(10) NOT NULL,
  "message" text,
  "type" varchar(50) NOT NULL DEFAULT 'text',
  "mediaUrl" varchar(2000),
  "messageId" varchar(255),
  "status" varchar(50),
  "leadId" uuid REFERENCES "Lead"("id") ON DELETE SET NULL,
  "campaignId" uuid REFERENCES "Campaign"("id") ON DELETE SET NULL,
  "userId" uuid REFERENCES "User"("id") ON DELETE SET NULL,
  "raw" json,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "WhatsappMessage_phone_idx" ON "WhatsappMessage" ("phone");
CREATE INDEX IF NOT EXISTS "WhatsappMessage_direction_idx" ON "WhatsappMessage" ("direction");
CREATE INDEX IF NOT EXISTS "WhatsappMessage_messageId_idx" ON "WhatsappMessage" ("messageId");
CREATE INDEX IF NOT EXISTS "WhatsappMessage_leadId_idx" ON "WhatsappMessage" ("leadId");
CREATE INDEX IF NOT EXISTS "WhatsappMessage_createdAt_idx" ON "WhatsappMessage" ("createdAt");

CREATE TABLE IF NOT EXISTS "WhatsappContact" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "phone" varchar(50) NOT NULL UNIQUE,
  "name" varchar(255),
  "leadId" uuid REFERENCES "Lead"("id") ON DELETE SET NULL,
  "tags" varchar(500),
  "optIn" boolean NOT NULL DEFAULT true,
  "lastSeen" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "WhatsappContact_phone_idx" ON "WhatsappContact" ("phone");
CREATE INDEX IF NOT EXISTS "WhatsappContact_leadId_idx" ON "WhatsappContact" ("leadId");
