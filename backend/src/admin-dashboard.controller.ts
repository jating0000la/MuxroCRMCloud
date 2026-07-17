import { Controller, Get, Post, Delete, Body, Param, Res, UseGuards, Query } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { DatabaseService } from './db/database.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { JobService } from './jobs/job.service';
import { OutboxService } from './common/outbox/outbox.service';
import { BackupService } from './common/backup/backup.service';
import { RefreshSessionService } from './auth/services/refresh-session.service';
import { jobLogs } from './db/schema';
import { eq, desc, sql as drizzleSql } from 'drizzle-orm';
import * as os from 'os';
import * as fs from 'fs';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminDashboardController {
  constructor(
    private database: DatabaseService,
    private jobService: JobService,
    private outboxService: OutboxService,
    private backupService: BackupService,
    private refreshSessionService: RefreshSessionService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'System health overview' })
  async getSystemHealth() {
    // Database health
    let dbStatus = 'ok';
    let dbResponseTime = 0;
    try {
      const start = Date.now();
      await this.database.db.execute(sql`SELECT 1`);
      dbResponseTime = Date.now() - start;
    } catch {
      dbStatus = 'error';
    }

    // Database size
    let dbSize = 'unknown';
    try {
      const result = await this.database.db.execute(sql`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);
      dbSize = (result.rows as any[])[0]?.size || 'unknown';
    } catch {}

    // Disk usage
    let diskUsage = { total: 0, used: 0, available: 0 };
    try {
      const stats = fs.statSync('/');
      diskUsage = {
        total: stats.size || 0,
        used: 0,
        available: 0,
      };
      // Use os.freemem/totalmem for a rough estimate
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      diskUsage = {
        total: totalMem,
        used: totalMem - freeMem,
        available: freeMem,
      };
    } catch {}

    // Memory usage
    const memUsage = process.memoryUsage();

    // Worker status (pg-boss)
    let workerStats = { queues: {}, error: null };
    try {
      const stats = await this.jobService.getQueueStats();
      workerStats = { queues: stats, error: null };
    } catch (error: any) {
      workerStats = { queues: {}, error: error.message };
    }

    // Job stats
    let jobStats = { pending: 0, completed: 0, failed: 0 };
    try {
      const [pending] = await this.database.db
        .select({ count: drizzleSql<number>`count(*)::int` })
        .from(jobLogs)
        .where(eq(jobLogs.status, 'pending'));

      const [completed] = await this.database.db
        .select({ count: drizzleSql<number>`count(*)::int` })
        .from(jobLogs)
        .where(eq(jobLogs.status, 'completed'));

      const [failed] = await this.database.db
        .select({ count: drizzleSql<number>`count(*)::int` })
        .from(jobLogs)
        .where(eq(jobLogs.status, 'failed'));

      jobStats = {
        pending: pending.count,
        completed: completed.count,
        failed: failed.count,
      };
    } catch {}

    // Outbox stats
    let outboxStats = { pending: 0, published: 0, failed: 0 };
    try {
      outboxStats = await this.outboxService.getStats();
    } catch {}

    // Backup stats
    let backupStats: any = { totalBackups: 0, latestBackup: null, lastJobStatus: null };
    try {
      backupStats = await this.backupService.getBackupStats();
    } catch {}

    // Session stats
    let sessionStats = { total: 0, activeUsers: 0 };
    try {
      sessionStats = await this.refreshSessionService.getStats();
    } catch {}

    // Connection stats
    let connectionStats: any = {};
    try {
      connectionStats = await this.database.getConnectionStats();
    } catch {}

    return {
      status: dbStatus === 'ok' && workerStats.error === null ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      database: {
        status: dbStatus,
        size: dbSize,
        responseTime: `${dbResponseTime}ms`,
        connections: connectionStats,
      },
      worker: {
        status: workerStats.error ? 'error' : 'running',
        queues: workerStats.queues,
        error: workerStats.error,
      },
      jobs: jobStats,
      outbox: outboxStats,
      backups: backupStats,
      sessions: sessionStats,
      memory: {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      },
      system: {
        nodeVersion: process.version,
        cpuCount: os.cpus().length,
      },
    };
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Get recent job logs' })
  async getJobLogs(@Query('status') status?: string, @Query('limit') limit?: string) {
    const limitNum = Math.min(100, parseInt(limit || '50') || 50);
    const conditions: any[] = [];
    if (status) conditions.push(eq(jobLogs.status, status));

    return this.database.db
      .select()
      .from(jobLogs)
      .where(conditions.length > 0 ? sql`${conditions[0]}` : undefined)
      .orderBy(desc(jobLogs.createdAt))
      .limit(limitNum);
  }

  @Get('failed-jobs')
  @ApiOperation({ summary: 'Get failed jobs for retry' })
  async getFailedJobs() {
    return this.database.db
      .select()
      .from(jobLogs)
      .where(eq(jobLogs.status, 'failed'))
      .orderBy(desc(jobLogs.createdAt))
      .limit(50);
  }

  @Get('backups')
  @ApiOperation({ summary: 'List available backups' })
  async getBackups() {
    return this.backupService.listBackups();
  }

  @Post('backups/trigger')
  @ApiOperation({ summary: 'Trigger a manual database backup now' })
  async triggerBackup(@Body() body?: { retentionDays?: number }) {
    const retentionDays =
      body?.retentionDays && body.retentionDays > 0 ? body.retentionDays : 7;
    return this.backupService.createBackup(retentionDays);
  }

  @Get('backups/:filename/download')
  @ApiOperation({ summary: 'Download a backup file' })
  async downloadBackup(@Param('filename') filename: string, @Res() res: Response) {
    const filepath = this.backupService.getBackupFilePath(filename);
    res.download(filepath, filename);
  }

  @Delete('backups/:filename')
  @ApiOperation({ summary: 'Delete a backup file' })
  async deleteBackup(@Param('filename') filename: string) {
    this.backupService.deleteBackup(filename);
    return { message: 'Backup deleted successfully' };
  }

  @Post('backups/:filename/restore')
  @ApiOperation({ summary: 'Restore the database from a backup file (destructive, overwrites current data)' })
  async restoreBackup(@Param('filename') filename: string) {
    return this.backupService.restoreBackup(filename);
  }
}
