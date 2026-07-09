import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('DatabaseService');
  private pool: Pool;
  public db: NodePgDatabase<typeof schema>;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 5,                         // Safe for 512MB VPS; raise only with Redis-backed sessions
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      options: '-c statement_timeout=30000', // Apply 30s timeout to ALL pool connections
    });

    this.db = drizzle(this.pool, { schema });

    // Test connection
    const client = await this.pool.connect();
    try {
      const { rows } = await client.query('SHOW statement_timeout');
      this.logger.log(`Database connected. statement_timeout=${rows[0]?.statement_timeout ?? '?'}`);
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log('Database disconnected');
  }

  async getConnectionStats() {
    const result = await this.pool.query(`
      SELECT 
        datname as database,
        count(*) as connections,
        max(EXTRACT(epoch FROM (now() - query_start))) as longest_query_seconds
      FROM pg_stat_activity
      GROUP BY datname
    `);
    return result.rows;
  }

  async getSlowQueries(limit = 10) {
    const result = await this.pool.query(`
      SELECT 
        query,
        mean_exec_time as avg_ms,
        calls,
        total_exec_time as total_ms
      FROM pg_stat_statements
      ORDER BY mean_exec_time DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  }
}
