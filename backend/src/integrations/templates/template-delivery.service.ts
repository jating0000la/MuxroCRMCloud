import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { OutboxService } from '../../common/outbox/outbox.service';
import { DatabaseService } from '../../db/database.service';
import { jobLogs, outboxEvents } from '../../db/schema';
import { JobExecutionService } from '../../jobs/job-execution.service';
import { JobService } from '../../jobs/job.service';
import { JOB_TYPES } from '../../jobs/job.types';
import { GupshupTemplatesService } from './gupshup-templates.service';

@Injectable()
export class TemplateDeliveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TemplateDeliveryService.name);
  private running = false;

  constructor(
    private readonly jobs: JobService,
    private readonly execution: JobExecutionService,
    private readonly outbox: OutboxService,
    private readonly templates: GupshupTemplatesService,
    private readonly database: DatabaseService,
  ) {}

  async onApplicationBootstrap() {
    // The standalone worker registers this queue with its other processors.
    // The API also consumes this queue so an API-only VPS can send automation.
    if (process.env.CRM_PROCESS_ROLE === 'worker' || this.running) return;
    await this.jobs.work(JOB_TYPES.WHATSAPP_FORM_GREETING, data =>
      this.execution.run(JOB_TYPES.WHATSAPP_FORM_GREETING, data, () => this.templates.sendAutomation(data)));
    this.running = true;
    this.outbox.startFormGreetingPublisher();
    void this.outbox.publishFormGreetings().catch(() => this.logger.warn('Pending WhatsApp messages will be queued on the next attempt'));
    this.logger.log('Automatic WhatsApp template sender started');
  }

  async status() {
    const [outbox] = await this.database.db.select({ pending: sql<number>`count(*)::int` }).from(outboxEvents)
      .where(and(eq(outboxEvents.eventType, JOB_TYPES.WHATSAPP_FORM_GREETING), eq(outboxEvents.published, false)));
    const attempts = await this.database.db.select({
      id: jobLogs.id, status: jobLogs.status, error: jobLogs.error, createdAt: jobLogs.createdAt,
      templateId: sql<string>`${jobLogs.payload}->>'templateId'`,
    }).from(jobLogs).where(eq(jobLogs.jobType, JOB_TYPES.WHATSAPP_FORM_GREETING)).orderBy(desc(jobLogs.createdAt)).limit(10);
    const [pendingEvent] = await this.database.db.select({ error: outboxEvents.lastError }).from(outboxEvents)
      .where(and(eq(outboxEvents.eventType, JOB_TYPES.WHATSAPP_FORM_GREETING), eq(outboxEvents.published, false)))
      .orderBy(desc(outboxEvents.retryCount), desc(outboxEvents.createdAt)).limit(1);
    return { senderRunning: this.running, pending: outbox.pending,
      pendingError: pendingEvent?.error || null, queue: await this.jobs.getQueueStatus(JOB_TYPES.WHATSAPP_FORM_GREETING), attempts };
  }
}
