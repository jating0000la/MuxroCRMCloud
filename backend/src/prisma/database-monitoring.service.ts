/**
 * Database Performance Monitoring Service
 * Tracks query performance and provides optimization recommendations
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

interface QueryStats {
  query: string;
  avgExecutionMs: number;
  calls: number;
  totalExecutionMs: number;
}

interface ConnectionStats {
  database: string;
  activeConnections: number;
  longestQuerySeconds: number;
}

@Injectable()
export class DatabaseMonitoringService {
  private logger = new Logger('DatabaseMonitoring');

  constructor(private prisma: PrismaService) {}

  /**
   * Get top slow queries
   * Identifies which queries need optimization
   */
  async getSlowQueries(limit = 10): Promise<QueryStats[]> {
    try {
      const stats = await this.prisma.$queryRaw<QueryStats[]>`
        SELECT 
          query,
          mean_exec_time as "avgExecutionMs",
          calls,
          total_exec_time as "totalExecutionMs"
        FROM pg_stat_statements
        ORDER BY mean_exec_time DESC
        LIMIT ${limit};
      `;

      // Log recommendations
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

  /**
   * Get current connection statistics
   * Ensures we're not exceeding connection limits
   */
  async getConnectionStats(): Promise<ConnectionStats[]> {
    try {
      const stats = await this.prisma.$queryRaw<ConnectionStats[]>`
        SELECT 
          datname as database,
          count(*) as "activeConnections",
          COALESCE(max(EXTRACT(epoch FROM (now() - query_start))), 0) as "longestQuerySeconds"
        FROM pg_stat_activity
        WHERE datname IS NOT NULL
        GROUP BY datname
        ORDER BY "activeConnections" DESC;
      `;

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

  /**
   * Get database size information
   * Helps identify when to archive old data
   */
  async getDatabaseSize() {
    try {
      const size = await this.prisma.$queryRaw<any>`
        SELECT 
          sum(pg_total_relation_size(schemaname||'.'||tablename)) / 1024 / 1024 as "totalSizeMB",
          sum(pg_relation_size(schemaname||'.'||tablename)) / 1024 / 1024 as "dataSizeMB",
          sum(pg_indexes_size(schemaname||'.'||tablename)) / 1024 / 1024 as "indexSizeMB"
        FROM pg_tables
        WHERE schemaname = 'public';
      `;

      this.logger.log(
        `Database size - Total: ${size[0].totalSizeMB.toFixed(2)}MB, ` +
        `Data: ${size[0].dataSizeMB.toFixed(2)}MB, ` +
        `Indexes: ${size[0].indexSizeMB.toFixed(2)}MB`,
      );

      return size[0];
    } catch (error) {
      this.logger.error('Failed to fetch database size');
      return null;
    }
  }

  /**
   * Get table statistics
   * Shows which tables have the most rows/queries
   */
  async getTableStats() {
    try {
      const stats = await this.prisma.$queryRaw<any>`
        SELECT 
          relname as table_name,
          n_live_tup as row_count,
          round(pg_total_relation_size(relid) / 1024 / 1024, 2) as size_mb,
          seq_scan as sequential_scans,
          idx_scan as index_scans
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC;
      `;

      return stats;
    } catch (error) {
      this.logger.error('Failed to fetch table stats');
      return [];
    }
  }

  /**
   * Get missing index recommendations
   * Shows which indexes would improve performance
   */
  async getMissingIndexes() {
    try {
      const recommendations = await this.prisma.$queryRaw<any>`
        SELECT 
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
        LIMIT 20;
      `;

      return recommendations;
    } catch (error) {
      this.logger.error('Failed to fetch index recommendations');
      return [];
    }
  }

  /**
   * Generate a performance report
   */
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
