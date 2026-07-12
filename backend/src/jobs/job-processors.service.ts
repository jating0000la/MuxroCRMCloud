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
    // WhatsApp message sending
    await this.jobService.work(JOB_TYPES.WHATSAPP_SEND_MESSAGE, async (data) => {
      await this.logJob(JOB_TYPES.WHATSAPP_SEND_MESSAGE, data, async () => {
        const config = await this.resolveGupshupConfig();
        await this.gupshupService.sendSessionMessage(
          config.apiKey,
          config.source,
          config.appName,
          data.phone,
          data.message,
        );
        return { success: true };
      });
    });

    // WhatsApp template sending
    await this.jobService.work(JOB_TYPES.WHATSAPP_SEND_TEMPLATE, async (data) => {
      await this.logJob(JOB_TYPES.WHATSAPP_SEND_TEMPLATE, data, async () => {
        const config = await this.resolveGupshupConfig();
        const mediaMsg = data.mediaUrl ? { type: data.mediaType || 'image', link: data.mediaUrl } : undefined;
        await this.gupshupService.sendTemplateMessage(
          config.apiKey,
          config.source,
          config.appName,
          data.phone,
          data.templateName,
          data.params,
          mediaMsg,
        );
        return { success: true };
      });
    });

    // WhatsApp form greeting
    await this.jobService.work(JOB_TYPES.WHATSAPP_FORM_GREETING, async (data) => {
      await this.logJob(JOB_TYPES.WHATSAPP_FORM_GREETING, data, async () => {
        const config = await this.resolveGupshupConfig();
        await this.gupshupService.sendSessionMessage(
          config.apiKey,
          config.source,
          config.appName,
          data.phone,
          data.message,
        );
        return { success: true };
      });
    });

    // IndiaMART lead fetch
    await this.jobService.work(JOB_TYPES.INDIAMART_FETCH, async (data) => {
      await this.logJob(JOB_TYPES.INDIAMART_FETCH, data, async () => {
        const config = await this.resolveIndiaMartConfig();
        const result = await this.indiamartService.fetchLeads(
          config.crmKey,
          data.startTime,
          data.endTime,
        );
        return { fetched: result.leads.length };
      });
    });

    // IndiaMART auto-import
    await this.jobService.work(JOB_TYPES.INDIAIART_AUTO_IMPORT, async (data) => {
      await this.logJob(JOB_TYPES.INDIAIART_AUTO_IMPORT, data, async () => {
        const config = await this.resolveIndiaMartConfig();
        const result = await this.indiamartService.autoImportLeads(
          data.campaignId,
          config.crmKey,
          data.startTime,
          data.endTime,
        );
        return result;
      });
    });

    // Bulk allocate round-robin
    await this.jobService.work(JOB_TYPES.BULK_ALLOCATE, async (data) => {
      await this.logJob(JOB_TYPES.BULK_ALLOCATE, data, async () => {
        const result = await this.roundRobinService.allocateRoundRobin(
          data.campaignId,
          data.leadIds,
        );
        return { allocated: result.length };
      });
    });

    // Notification sync
    await this.jobService.work(JOB_TYPES.NOTIFICATION_SYNC, async (data) => {
      await this.logJob(JOB_TYPES.NOTIFICATION_SYNC, data, async () => {
        await this.notificationsService.syncNotificationsForUser(data.userId);
        return { success: true };
      });
    });

    // Outbox event processing
    await this.jobService.work(JOB_TYPES.OUTBOX_PUBLISH, async (data) => {
      await this.logJob(JOB_TYPES.OUTBOX_PUBLISH, data, async () => {
        const count = await this.outboxService.processPendingEvents(data.batchSize || 50);
        return { processed: count };
      });
    });

    // Database backup
    await this.jobService.work(JOB_TYPES.BACKUP_DATABASE, async (data) => {
      await this.logJob(JOB_TYPES.BACKUP_DATABASE, data, async () => {
        const result = await this.backupService.createBackup(data.retentionDays || 7);
        return result;
      });
    });

    this.logger.log('All job processors registered');
  }

  private async logJob(
    jobType: string,
    payload: any,
    handler: () => Promise<any>,
  ): Promise<any> {
    const [log] = await this.database.db
      .insert(jobLogs)
      .values({
        jobType,
        payload,
        status: 'running',
        startedAt: new Date(),
      })
      .returning();

    try {
      const result = await handler();
      await this.database.db
        .update(jobLogs)
        .set({
          status: 'completed',
          result,
          completedAt: new Date(),
        })
        .where(eq(jobLogs.id, log.id));
      return result;
    } catch (error: any) {
      await this.database.db
        .update(jobLogs)
        .set({
          status: 'failed',
          error: error.message,
          completedAt: new Date(),
        })
        .where(eq(jobLogs.id, log.id));
      throw error;
    }
  }
}
