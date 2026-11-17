import { JOB_TYPES } from '../../jobs/job.types';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { eq, and, lt, sql, desc, or } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import { outboxEvents } from '../../db/schema';
import { JobService } from '../../jobs/job.service';

@Injectable()
export class OutboxService implements OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private publishing?: Promise<number>;

  startFormGreetingPublisher() {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.publishFormGreetings().catch(() => {}); }, 3000);
    this.timer.unref();
  }

  async onModuleDestroy() { if (this.timer) clearInterval(this.timer); await this.publishing?.catch(() => {}); }

  publishFormGreetings() {
    if (!this.publishing) this.publishing = this.processPendingEvents(50, JOB_TYPES.WHATSAPP_FORM_GREETING).finally(() => { this.publishing = undefined; });
    return this.publishing;
  }
  private logger = new Logger('OutboxService');

  constructor(
    private database: DatabaseService,
    private jobService: JobService,
  ) {}

  async publishEvent(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, any>,
    options?: {
      maxRetries?: number;
      idempotencyKey?: string;
    },
  ): Promise<string> {
    const [event] = await this.database.db
      .insert(outboxEvents)
      .values({
        aggregateType,
        aggregateId,
        eventType,
        payload,
        maxRetries: options?.maxRetries ?? 3,
      })
      .returning();

    this.logger.debug(`Outbox event created: ${eventType} (${event.id})`);
    return event.id;
  }

  async processPendingEvents(batchSize: number = 50, eventType?: string): Promise<number> {
    return this.database.db.transaction(async tx => {
      const events = await tx.select().from(outboxEvents)
        .where(and(eq(outboxEvents.published, false), or(eq(outboxEvents.eventType, JOB_TYPES.WHATSAPP_FORM_GREETING), lt(outboxEvents.retryCount, outboxEvents.maxRetries)), eventType ? eq(outboxEvents.eventType, eventType) : undefined))
        .orderBy(outboxEvents.createdAt).limit(Math.max(1, Math.min(100, batchSize))).for('update', { skipLocked: true });
      let processed = 0;
      for (const event of events) {
        try {
          await this.jobService.addJob(event.eventType, event.payload, { retryLimit: 3, idempotencyKey: event.id });
          await tx.update(outboxEvents).set({ published: true, publishedAt: new Date() }).where(eq(outboxEvents.id, event.id));
          ++processed;
        } catch (error: any) {
          await tx.update(outboxEvents).set({ retryCount: event.retryCount + 1, lastError: 'Could not queue message; check worker/database availability.' }).where(eq(outboxEvents.id, event.id));
        }
      }
      return processed;
    });
  }

  async getFailedEvents(limit: number = 20) {
    return this.database.db
      .select()
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.published, false),
          sql`${outboxEvents.retryCount} >= ${outboxEvents.maxRetries}`,
        ),
      )
      .orderBy(desc(outboxEvents.createdAt))
      .limit(limit);
  }

  async retryEvent(eventId: string): Promise<void> {
    await this.database.db
      .update(outboxEvents)
      .set({
        retryCount: 0,
        lastError: null,
      })
      .where(eq(outboxEvents.id, eventId));
  }

  async getStats() {
    const [{ pending }] = await this.database.db
      .select({ pending: sql<number>`count(*)::int` })
      .from(outboxEvents)
      .where(eq(outboxEvents.published, false));

    const [{ published }] = await this.database.db
      .select({ published: sql<number>`count(*)::int` })
      .from(outboxEvents)
      .where(eq(outboxEvents.published, true));

    const [{ failed }] = await this.database.db
      .select({ failed: sql<number>`count(*)::int` })
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.published, false),
          sql`${outboxEvents.retryCount} >= ${outboxEvents.maxRetries}`,
        ),
      );

    return { pending, published, failed };
  }

  async cleanupPublishedEvents(retentionDays: number = 7): Promise<number> {
    const result = await this.database.db
      .delete(outboxEvents)
      .where(
        and(
          eq(outboxEvents.published, true),
          sql`${outboxEvents.publishedAt} < NOW() - (${retentionDays} * INTERVAL '1 day')`,
        ),
      );
    const deleted = (result as any).rowCount || 0;
    if (deleted > 0) {
      this.logger.debug(`Cleaned up ${deleted} old outbox events`);
    }
    return deleted;
  }
}
