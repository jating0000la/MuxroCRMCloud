import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgBoss } from 'pg-boss';
import { DatabaseService, databaseApplicationName } from '../db/database.service';
import { JOB_TYPES } from './job.types';

@Injectable()
export class JobService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('JobService');
  private boss!: PgBoss;

  constructor(
    private configService: ConfigService,
    private database: DatabaseService,
  ) {}

  async onModuleInit() {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    const url = new URL(connectionString!);
    url.searchParams.set('application_name', databaseApplicationName('jobs'));
    this.boss = new PgBoss(url.toString());

    this.boss.on('error', (err) => {
      this.logger.error(`pg-boss error: ${err.message}`);
    });

    await this.boss.start();
    for (const name of Object.values(JOB_TYPES)) await this.boss.createQueue(name);
    this.logger.log('pg-boss started');
  }

  async onModuleDestroy() {
    if (this.boss) {
      await this.boss.stop();
      this.logger.log('pg-boss stopped');
    }
  }

  async addJob(
    queueName: string,
    data: any,
    options?: {
      priority?: number;
      startAfter?: number | Date;
      singletonKey?: string;
      retryLimit?: number;
      retryBackoff?: boolean;
      idempotencyKey?: string;
    },
  ): Promise<string | null> {
    const jobOptions = {
      priority: options?.priority,
      startAfter: options?.startAfter,
      singletonKey: options?.singletonKey || options?.idempotencyKey,
      retryLimit: options?.retryLimit ?? 3,
      retryBackoff: options?.retryBackoff ?? true,
    };
    const jobId = await this.boss.send(queueName, data,
      Object.fromEntries(Object.entries(jobOptions).filter(([, value]) => value !== undefined)));
    this.logger.debug(`Job ${queueName} queued: ${jobId}`);
    return jobId;
  }

  async addBulkJobs(
    queueName: string,
    items: any[],
    options?: {
      priority?: number;
      retryLimit?: number;
      retryBackoff?: boolean;
    },
  ): Promise<string[]> {
    const jobs = items.map((data) => ({
      name: queueName,
      data,
      priority: options?.priority ?? 0,
      retryLimit: options?.retryLimit ?? 3,
      retryBackoff: options?.retryBackoff ?? true,
    }));
    const result = await this.boss.insert(queueName, jobs, { returnId: true });
    this.logger.debug(`Bulk jobs ${queueName}: ${result?.length ?? 0} queued`);
    return result || [];
  }

  async work(
    queueName: string,
    handler: (data: any) => Promise<any>,
  ) {
    await this.boss.work(queueName, async (jobs: any[]) => {
      for (const job of jobs) {
        try {
          this.logger.debug(`Processing job ${queueName}:${job.id}`);
          await handler(job.data);
          this.logger.debug(`Completed job ${queueName}:${job.id}`);
        } catch (err: any) {
          this.logger.error(`Failed job ${queueName}:${job.id}: ${err.message}`);
          throw err;
        }
      }
    });
  }

  async getQueueStats() {
    try {
      const queues = await this.boss.getQueues();
      const stats: Record<string, any> = {};
      for (const q of queues) {
        try {
          const queueStats = await this.boss.getQueueStats(q.name);
          stats[q.name] = queueStats;
        } catch {
          stats[q.name] = { error: 'failed to get stats' };
        }
      }
      return stats;
    } catch {
      return {};
    }
  }

  async getQueueStatus(name: string) {
    const readings = await this.boss.getQueueStats(name, { force: true });
    return readings.at(-1) || null;
  }

  async retryJob(name: string, jobId: string) {
    await this.boss.retry(name, jobId);
  }

  async cancelJob(name: string, jobId: string) {
    await this.boss.cancel(name, jobId);
  }
}
