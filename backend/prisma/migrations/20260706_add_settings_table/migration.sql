-- CreateTable "Setting"
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable "SettingAuditLog"
CREATE TABLE "SettingAuditLog" (
    "id" TEXT NOT NULL,
    "settingId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'update',
    "changedBy" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE INDEX "Setting_key_idx" ON "Setting"("key");

-- CreateIndex
CREATE INDEX "Setting_updatedAt_idx" ON "Setting"("updatedAt");

-- CreateIndex
CREATE INDEX "SettingAuditLog_settingId_idx" ON "SettingAuditLog"("settingId");

-- CreateIndex
CREATE INDEX "SettingAuditLog_createdAt_idx" ON "SettingAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "SettingAuditLog" ADD CONSTRAINT "SettingAuditLog_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "Setting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
