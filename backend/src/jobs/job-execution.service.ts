import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { jobLogs } from '../db/schema';

@Injectable()
export class JobExecutionService {
  private readonly logger = new Logger(JobExecutionService.name);
  constructor(private readonly database: DatabaseService) {}

  async run(
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
