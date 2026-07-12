import { Injectable, Logger } from '@nestjs/common';
import { JobService } from './job.service';
import { JOB_TYPES } from './job.types';
import { GupshupService } from '../integrations/gupshup.service';
import { IndiamartService } from '../integrations/indiamart.service';
import { BulkImportService } from '../bulk-import/bulk-import.service';
import { RoundRobinService } from '../common/services/round-robin.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OutboxService } from '../common/outbox/outbox.service';
import { BackupService } from '../common/backup/backup.service';
import { SettingsService } from '../settings/settings.service';
import { EncryptionService } from '../settings/encryption.service';
import { DatabaseService } from '../db/database.service';
import { jobLogs } from '../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class JobProcessors {
  private logger = new Logger('JobProcessors');

  constructor(
    private jobService: JobService,
    private gupshupService: GupshupService,
    private indiamartService: IndiamartService,
    private bulkImportService: BulkImportService,
    private roundRobinService: RoundRobinService,
    private notificationsService: NotificationsService,
    private outboxService: OutboxService,
    private backupService: BackupService,
    private settingsService: SettingsService,
    private encryptionService: EncryptionService,
    private database: DatabaseService,
  ) {}

  private async resolveGupshupConfig() {
    try {
      const apiKey = await this.settingsService.getSettingForUse('gupshupApiKey');
      const source = await this.settingsService.getSettingForUse('gupshupSource');
      const appName = await this.settingsService.getSettingForUse('gupshupAppName');
      return { apiKey, source, appName };
    } catch {
      return { apiKey: '', source: '', appName: '' };
    }
  }

  private async resolveIndiaMartConfig() {
    try {
      const crmKey = await this.settingsService.getSettingForUse('indiamartCrmKey');
      return { crmKey };
    } catch {
      return { crmKey: '' };
    }
  }

  async registerAllProcessors() {
    const processors = [
      { type: JOB_TYPES.WHATSAPP_SEND_MESSAGE, handler: async (data: any) => {
        const config = await this.resolveGupshupConfig();
        await this.gupshupService.sendSessionMessage(config.apiKey, config.source, config.appName, data.phone, data.message);
        return { success: true };
      }},
      { type: JOB_TYPES.WHATSAPP_SEND_TEMPLATE, handler: async (data: any) => {
        const config = await this.resolveGupshupConfig();
        const mediaMsg = data.mediaUrl ? { type: data.mediaType || 'image', link: data.mediaUrl } : undefined;
        await this.gupshupService.sendTemplateMessage(config.apiKey, config.source, config.appName, data.phone, data.templateName, data.params, mediaMsg);
        return { success: true };
      }},
      { type: JOB_TYPES.WHATSAPP_FORM_GREETING, handler: async (data: any) => {
        const config = await this.resolveGupshupConfig();
        await this.gupshupService.sendSessionMessage(config.apiKey, config.source, config.appName, data.phone, data.message);
        return { success: true };
      }},
      { type: JOB_TYPES.INDIAMART_FETCH, handler: async (data: any) => {
        const config = await this.resolveIndiaMartConfig();
        const result = await this.indiamartService.fetchLeads(config.crmKey, data.startTime, data.endTime);
        return { fetched: result.leads.length };
      }},
      { type: JOB_TYPES.INDIAMART_AUTO_IMPORT, handler: async (data: any) => {
        const config = await this.resolveIndiaMartConfig();
        return await this.indiamartService.autoImportLeads(data.campaignId, config.crmKey, data.startTime, data.endTime);
      }},
      { type: JOB_TYPES.BULK_ALLOCATE, handler: async (data: any) => {
        const result = await this.roundRobinService.allocateRoundRobin(data.campaignId, data.leadIds);
        return { allocated: result.length };
      }},
      { type: JOB_TYPES.NOTIFICATION_SYNC, handler: async (data: any) => {
        await this.notificationsService.syncNotificationsForUser(data.userId);
        return { success: true };
      }},
      { type: JOB_TYPES.OUTBOX_PUBLISH, handler: async (data: any) => {
        const count = await this.outboxService.processPendingEvents(data.batchSize || 50);
        return { processed: count };
      }},
      { type: JOB_TYPES.BACKUP_DATABASE, handler: async (data: any) => {
        return await this.backupService.createBackup(data.retentionDays || 7);
      }},
    ];

    let registered = 0;
    for (const proc of processors) {
      try {
        await this.jobService.work(proc.type, async (data: any) => {
          await this.logJob(proc.type, data, async () => proc.handler(data));
        });
        registered++;
      } catch (error: any) {
        this.logger.error(`Failed to register processor ${proc.type}: ${error.message}`);
      }
    }
    this.logger.log(`Registered ${registered}/${processors.length} job processors`);
  }

  private async logJob(
    jobType: string,
    payload: any,
    handler: () => Promise<any>,
  ): Promise<any> {
    // Non-blocking: log insert failure doesn't block the job
    let logId: string | null = null;
    try {
      const [log] = await this.database.db
        .insert(jobLogs)
        .values({
          jobType,
          payload,
          status: 'running',
          startedAt: new Date(),
        })
        .returning();
      logId = log.id;
    } catch (logError: any) {
      this.logger.warn(`Job log insert failed: ${logError.message}`);
    }

    try {
      const result = await handler();
      if (logId) {
        try {
          await this.database.db
            .update(jobLogs)
            .set({ status: 'completed', result, completedAt: new Date() })
            .where(eq(jobLogs.id, logId));
        } catch {}
      }
      return result;
    } catch (error: any) {
      if (logId) {
        try {
          await this.database.db
            .update(jobLogs)
            .set({ status: 'failed', error: error.message, completedAt: new Date() })
            .where(eq(jobLogs.id, logId));
        } catch {}
      }
      throw error;
    }
  }
}
