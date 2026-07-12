import { Injectable, Logger } from '@nestjs/common';
import { eq, and, lt, sql, desc } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import { outboxEvents } from '../../db/schema';
import { JobService } from '../../jobs/job.service';

@Injectable()
export class OutboxService {
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

  async processPendingEvents(batchSize: number = 50): Promise<number> {
    const events = await this.database.db
      .select()
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.published, false),
          lt(outboxEvents.retryCount, outboxEvents.maxRetries),
        ),
      )
      .orderBy(outboxEvents.createdAt)
      .limit(batchSize);

    if (events.length === 0) return 0;

    let processed = 0;
    for (const event of events) {
      try {
        await this.jobService.addJob(event.eventType, event.payload, {
          retryLimit: 2,
          idempotencyKey: event.id,
        });

        await this.database.db
          .update(outboxEvents)
          .set({
            published: true,
            publishedAt: new Date(),
          })
          .where(eq(outboxEvents.id, event.id));

        processed++;
      } catch (error: any) {
        await this.database.db
          .update(outboxEvents)
          .set({
            retryCount: event.retryCount + 1,
            lastError: error.message,
          })
          .where(eq(outboxEvents.id, event.id));

        this.logger.warn(`Failed to process outbox event ${event.id}: ${error.message}`);
      }
    }

    this.logger.debug(`Processed ${processed}/${events.length} outbox events`);
    return processed;
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
          sql`${outboxEvents.publishedAt} < NOW() - INTERVAL '${retentionDays} days'`,
        ),
      );
    const deleted = (result as any).rowCount || 0;
    if (deleted > 0) {
      this.logger.debug(`Cleaned up ${deleted} old outbox events`);
    }
    return deleted;
  }
}
