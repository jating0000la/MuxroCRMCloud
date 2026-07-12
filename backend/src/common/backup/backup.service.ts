import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import { jobLogs } from '../../db/schema';

const execFileAsync = promisify(execFile);

@Injectable()
export class BackupService {
  private logger = new Logger('BackupService');
  private backupDir: string;

  constructor(
    private configService: ConfigService,
    private database: DatabaseService,
  ) {
    this.backupDir = this.configService.get<string>('BACKUP_DIR', '/backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  private parseDatabaseUrl(dbUrl: string) {
    const url = new URL(dbUrl);
    const dbName = url.pathname.slice(1).split('?')[0];
    return {
      host: url.hostname,
      port: url.port || '5432',
      user: url.username,
      database: dbName,
      password: url.password,
    };
  }

  async createBackup(retentionDays: number = 7): Promise<{
    file: string;
    size: number;
    duration: number;
  }> {
    const startTime = Date.now();
    const dbUrl = this.configService.get<string>('DATABASE_URL');
    if (!dbUrl) throw new Error('DATABASE_URL not configured');

    const db = this.parseDatabaseUrl(dbUrl);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `crm_db_${timestamp}.sql.gz`;
    const filepath = path.join(this.backupDir, filename);

    this.logger.log(`Starting backup: ${filename}`);

    try {
      const { stdout } = await execFileAsync('pg_dump', [
        '-h', db.host,
        '-p', db.port,
        '-U', db.user,
        '-d', db.database,
        '--format=custom',
        '--compress=6',
      ], {
        maxBuffer: 50 * 1024 * 1024,
        timeout: 300000,
        env: { ...process.env, PGPASSWORD: db.password },
      });

      fs.writeFileSync(filepath, stdout);

      const stats = fs.statSync(filepath);
      const duration = Date.now() - startTime;

      this.logger.log(`Backup completed: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)}MB, ${duration}ms)`);

      try {
        await this.database.db.insert(jobLogs).values({
          jobType: 'backup-database',
          status: 'completed',
          payload: { filename, size: stats.size },
          result: { filename, size: stats.size, duration },
          startedAt: new Date(startTime),
          completedAt: new Date(),
        });
      } catch { /* log failure is non-blocking */ }

      await this.cleanupOldBackups(retentionDays);

      return { file: filename, size: stats.size, duration };
    } catch (error: any) {
      this.logger.error(`Backup failed: ${error.message}`);
      try {
        await this.database.db.insert(jobLogs).values({
          jobType: 'backup-database',
          status: 'failed',
          error: error.message,
          startedAt: new Date(startTime),
          completedAt: new Date(),
        });
      } catch { /* non-blocking */ }
      throw error;
    }
  }

  listBackups(): Array<{ filename: string; size: number; created: Date }> {
    if (!fs.existsSync(this.backupDir)) return [];

    return fs.readdirSync(this.backupDir)
      .filter(f => f.endsWith('.sql.gz'))
      .map(f => {
        const filepath = path.join(this.backupDir, f);
        const stats = fs.statSync(filepath);
        return { filename: f, size: stats.size, created: stats.birthtime };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  async getBackupStats() {
    const backups = this.listBackups();
    const latest = backups[0];

    let lastJob: any = null;
    try {
      const [job] = await this.database.db
        .select()
        .from(jobLogs)
        .where(eq(jobLogs.jobType, 'backup-database'))
        .orderBy(jobLogs.createdAt)
        .limit(1);
      lastJob = job;
    } catch { /* non-blocking */ }

    return {
      totalBackups: backups.length,
      latestBackup: latest ? {
        filename: latest.filename,
        size: latest.size,
        created: latest.created,
      } : null,
      lastJobStatus: lastJob?.status,
      lastJobError: lastJob?.error,
    };
  }

  async cleanupOldBackups(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const backups = this.listBackups();
    let deleted = 0;

    for (const backup of backups) {
      if (backup.created < cutoff) {
        const filepath = path.join(this.backupDir, backup.filename);
        fs.unlinkSync(filepath);
        this.logger.log(`Deleted old backup: ${backup.filename}`);
        deleted++;
      }
    }

    return deleted;
  }
}
