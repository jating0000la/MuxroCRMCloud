import { Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from './database.service';

interface QueryStats {
  [key: string]: unknown;
  query: string;
  avgExecutionMs: number;
  calls: number;
  totalExecutionMs: number;
}

interface ConnectionStats {
  [key: string]: unknown;
  database: string;
  activeConnections: number;
  longestQuerySeconds: number;
}

@Injectable()
export class DatabaseMonitoringService {
  private logger = new Logger('DatabaseMonitoring');

  constructor(private database: DatabaseService) {}

  async getSlowQueries(limit = 10): Promise<QueryStats[]> {
    try {
      const result = await this.database.db.execute<QueryStats>(
        sql`SELECT 
          query,
          mean_exec_time as "avgExecutionMs",
          calls,
          total_exec_time as "totalExecutionMs"
        FROM pg_stat_statements
        ORDER BY mean_exec_time DESC
        LIMIT ${limit}`
      );

      const stats = result.rows;

      stats.forEach((stat) => {
        if (stat.avgExecutionMs > 500) {
          this.logger.warn(
            `Slow query detected (${stat.avgExecutionMs.toFixed(2)}ms): ${stat.query.substring(0, 80)}...`,
          );
        }
      });

      return stats;
    } catch (error) {
      this.logger.error('Failed to fetch slow queries (pg_stat_statements extension may not be enabled)');
      return [];
    }
  }

  async getConnectionStats(): Promise<ConnectionStats[]> {
    try {
      const result = await this.database.db.execute<ConnectionStats>(
        sql`SELECT 
          datname as database,
          count(*) as "activeConnections",
          COALESCE(max(EXTRACT(epoch FROM (now() - query_start))), 0) as "longestQuerySeconds"
        FROM pg_stat_activity
        WHERE datname IS NOT NULL
        GROUP BY datname
        ORDER BY "activeConnections" DESC`
      );

      const stats = result.rows;

      stats.forEach((stat) => {
        if (stat.activeConnections > 15) {
          this.logger.warn(
            `High connection count for ${stat.database}: ${stat.activeConnections} connections`,
          );
        }
      });

      return stats;
    } catch (error) {
      this.logger.error('Failed to fetch connection stats');
      return [];
    }
  }

  async getDatabaseSize() {
    try {
      const result = await this.database.db.execute<any>(
        sql`SELECT 
          sum(pg_total_relation_size(schemaname||'.'||tablename)) / 1024 / 1024 as "totalSizeMB",
          sum(pg_relation_size(schemaname||'.'||tablename)) / 1024 / 1024 as "dataSizeMB",
          sum(pg_indexes_size(schemaname||'.'||tablename)) / 1024 / 1024 as "indexSizeMB"
        FROM pg_tables
        WHERE schemaname = 'public'`
      );

      const size = result.rows[0];
      this.logger.log(
        `Database size - Total: ${size.totalSizeMB.toFixed(2)}MB, ` +
        `Data: ${size.dataSizeMB.toFixed(2)}MB, ` +
        `Indexes: ${size.indexSizeMB.toFixed(2)}MB`,
      );

      return size;
    } catch (error) {
      this.logger.error('Failed to fetch database size');
      return null;
    }
  }

  async getTableStats() {
    try {
      const result = await this.database.db.execute<any>(
        sql`SELECT 
          relname as table_name,
          n_live_tup as row_count,
          round(pg_total_relation_size(relid) / 1024 / 1024, 2) as size_mb,
          seq_scan as sequential_scans,
          idx_scan as index_scans
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC`
      );

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to fetch table stats');
      return [];
    }
  }

  async getMissingIndexes() {
    try {
      const result = await this.database.db.execute<any>(
        sql`SELECT 
          schemaname,
          tablename,
          attname as column_name,
          n_distinct as cardinality,
          correlation,
          avg_width
        FROM pg_stats
        WHERE schemaname = 'public'
        AND n_distinct > 100
        AND correlation < 0.1
        ORDER BY n_distinct DESC
        LIMIT 20`
      );

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to fetch index recommendations');
      return [];
    }
  }

  async generatePerformanceReport() {
    this.logger.log('=== Database Performance Report ===');

    const connections = await this.getConnectionStats();
    this.logger.log(`Active connections: ${connections.length > 0 ? connections[0].activeConnections : 'N/A'}`);

    const size = await this.getDatabaseSize();
    this.logger.log(
      `Database size: ${size ? `${size.totalSizeMB.toFixed(2)}MB` : 'N/A'}`,
    );

    const slowQueries = await this.getSlowQueries(5);
    if (slowQueries.length > 0) {
      this.logger.log(`Top slow query: ${slowQueries[0].avgExecutionMs.toFixed(2)}ms`);
    }

    const tableStats = await this.getTableStats();
    if (tableStats.length > 0) {
      this.logger.log(
        `Largest table: ${tableStats[0].table_name} (${tableStats[0].row_count} rows)`,
      );
    }

    this.logger.log('====================================');
  }
}
