import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import { jobLogs } from '../../db/schema';

// Filenames are generated exclusively by createBackup() as crm_db_<timestamp>.dump
const SAFE_BACKUP_FILENAME = /^[A-Za-z0-9._-]+\.dump$/;

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
    const filename = `crm_db_${timestamp}.dump`;
    const filepath = path.join(this.backupDir, filename);

    this.logger.log(`Starting backup: ${filename}`);

    try {
      // encoding: 'buffer' is required — pg_dump's --format=custom output is a binary
      // archive, and capturing it as a default utf8 string would silently corrupt it.
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
        encoding: 'buffer' as any,
        env: { ...process.env, PGPASSWORD: db.password },
      }) as unknown as { stdout: Buffer };

      // pg_dump --format=custom already compresses at level 6; no double-gzip needed
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
      .filter(f => f.endsWith('.dump'))
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

  /**
   * Resolve a backup filename to a safe absolute path.
   * Rejects path traversal and any filename not matching our own naming pattern,
   * and verifies the file actually exists in the backup directory listing.
   */
  getBackupFilePath(filename: string): string {
    if (!SAFE_BACKUP_FILENAME.test(filename) || filename.includes('..')) {
      throw new BadRequestException('Invalid backup filename');
    }

    const resolvedDir = path.resolve(this.backupDir);
    const resolvedPath = path.resolve(resolvedDir, filename);
    if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
      throw new BadRequestException('Invalid backup filename');
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new NotFoundException('Backup file not found');
    }

    return resolvedPath;
  }

  deleteBackup(filename: string): void {
    const filepath = this.getBackupFilePath(filename);
    fs.unlinkSync(filepath);
    this.logger.log(`Deleted backup: ${filename}`);
  }

  /**
   * Restore the database from a backup file. DESTRUCTIVE: overwrites all
   * existing data. Uses `pg_restore --clean --if-exists` against the live
   * database (rather than dropping/recreating it) so the app's own connection
   * pool doesn't get pulled out from under it mid-restore. Callers should
   * restart the backend and worker processes immediately after a restore to
   * clear any cached/prepared state.
   */
  async restoreBackup(filename: string): Promise<{ filename: string; duration: number; warnings?: string }> {
    const filepath = this.getBackupFilePath(filename);
    const dbUrl = this.configService.get<string>('DATABASE_URL');
    if (!dbUrl) throw new Error('DATABASE_URL not configured');

    const db = this.parseDatabaseUrl(dbUrl);
    const startTime = Date.now();
    const tmpDumpPath = path.join(this.backupDir, `.restore-${Date.now()}.dump`);

    this.logger.warn(`Starting restore from ${filename} — this will overwrite existing data in database "${db.database}"`);

    try {
      // pg_dump --format=custom output is already compressed; pass directly to pg_restore
      const dump = fs.readFileSync(filepath);
      fs.writeFileSync(tmpDumpPath, dump);

      let stderr = '';
      try {
        const result = await execFileAsync('pg_restore', [
          '-h', db.host,
          '-p', db.port,
          '-U', db.user,
          '-d', db.database,
          '--clean',
          '--if-exists',
          '--no-owner',
          '--no-privileges',
          tmpDumpPath,
        ], {
          maxBuffer: 50 * 1024 * 1024,
          timeout: 300000,
          env: { ...process.env, PGPASSWORD: db.password },
        });
        stderr = result.stderr;
      } catch (err: any) {
        // pg_restore exits with code 1 for non-fatal warnings (e.g. objects that
        // didn't exist to be dropped). Treat that as a successful restore with
        // warnings rather than a hard failure; any other exit code is a real error.
        if (err.code === 1) {
          stderr = err.stderr || err.message;
          this.logger.warn(`Restore of ${filename} completed with warnings: ${stderr.slice(0, 2000)}`);
        } else {
          throw err;
        }
      }

      const duration = Date.now() - startTime;
      this.logger.warn(`Restore completed from ${filename} in ${duration}ms. Restart the backend and worker processes now.`);

      try {
        await this.database.db.insert(jobLogs).values({
          jobType: 'restore-database',
          status: 'completed',
          payload: { filename },
          result: { filename, duration },
          startedAt: new Date(startTime),
          completedAt: new Date(),
        });
      } catch { /* non-blocking */ }

      return { filename, duration, warnings: stderr || undefined };
    } catch (error: any) {
      this.logger.error(`Restore failed: ${error.message}`);
      try {
        await this.database.db.insert(jobLogs).values({
          jobType: 'restore-database',
          status: 'failed',
          error: error.message,
          startedAt: new Date(startTime),
          completedAt: new Date(),
        });
      } catch { /* non-blocking */ }
      throw error;
    } finally {
      if (fs.existsSync(tmpDumpPath)) fs.unlinkSync(tmpDumpPath);
    }
  }
}
