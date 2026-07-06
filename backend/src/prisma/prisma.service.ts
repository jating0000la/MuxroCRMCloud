import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('PrismaService');

  constructor() {
    super({
      // Log queries in development
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();

    // Set query timeout to 30 seconds to prevent hanging queries
    await this.$executeRawUnsafe('SET statement_timeout TO 30000');

    this.logger.log('Prisma connected. Query timeout: 30s');

    // Add query performance logging middleware (if development)
    if (process.env.NODE_ENV === 'development') {
      this.$use(async (params, next) => {
        const before = Date.now();
        const result = await next(params);
        const after = Date.now();
        const duration = after - before;

        // Log slow queries (> 100ms)
        if (duration > 100) {
          this.logger.warn(
            `Slow query detected (${duration}ms): ${params.model}.${params.action}`,
          );
        }

        return result;
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Get database connection statistics
   */
  async getConnectionStats() {
    return this.$queryRaw`
      SELECT 
        datname as database,
        count(*) as connections,
        max(EXTRACT(epoch FROM (now() - query_start))) as longest_query_seconds
      FROM pg_stat_activity
      GROUP BY datname;
    `;
  }

  /**
   * Get slow query information
   */
  async getSlowQueries(limit = 10) {
    return this.$queryRaw`
      SELECT 
        query,
        mean_exec_time as avg_ms,
        calls,
        total_exec_time as total_ms
      FROM pg_stat_statements
      ORDER BY mean_exec_time DESC
      LIMIT ${limit};
    `;
  }
}
