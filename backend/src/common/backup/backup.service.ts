import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { desc, eq, is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { DatabaseService, databaseApplicationName } from '../../db/database.service';
import * as schema from '../../db/schema';
import { jobLogs } from '../../db/schema';
import { BackupMaintenanceService } from './backup-maintenance.service';
import { Client } from 'pg';

const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.dump$/;
const BACKUP_LOCK = 1465078355;
const execFileAsync = promisify(execFile);
const quote = (name: string) => '"' + name.replace(/"/g, '""') + '"';

export interface BackupInfo { filename: string; size: number; created: Date; }
export interface BackupResult { file: string; size: number; duration: number; warnings?: string; }
export interface RestoreResult { filename: string; duration: number; recoveryBackup: string; requiresLogin: true; }

@Injectable()
export class BackupService {
  private readonly logger = new Logger('BackupService');
  private readonly backupDir: string;
  private toolsCheckedAt = 0;

  constructor(private configService: ConfigService, private database: DatabaseService,
    private maintenance: BackupMaintenanceService) {
    this.backupDir = path.resolve(this.configService.get<string>('BACKUP_DIR') || '/backups');
  }

  private ensureStorage() {
    try {
      fs.mkdirSync(this.backupDir, { recursive: true, mode: 0o700 });
      fs.accessSync(this.backupDir, fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK);
    } catch { throw new ServiceUnavailableException('Configure a readable, writable BACKUP_DIR for the backend.'); }
  }

  private defaultRetentionDays() {
    const value = Number(this.configService.get('BACKUP_RETENTION_DAYS') ?? 7);
    this.validateRetention(value);
    return value;
  }

  private validateRetention(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > 365) {
      throw new BadRequestException('Retention must be a whole number between 1 and 365 days.');
    }
  }

  protected toolEnvironment(): NodeJS.ProcessEnv {
    const connection = this.configService.get<string>('DATABASE_URL');
    if (!connection) throw new ServiceUnavailableException('DATABASE_URL is not configured.');
    let url: URL;
    try { url = new URL(connection); } catch { throw new ServiceUnavailableException('DATABASE_URL is invalid.'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new ServiceUnavailableException('DATABASE_URL must be a PostgreSQL URL.');
    const env: NodeJS.ProcessEnv = { ...process.env, PGAPPNAME: databaseApplicationName('backup'), PGCONNECT_TIMEOUT: '10' };
    const assign = (key: string, value: string | undefined | null) => { if (value) env[key] = value; };
    assign('PGHOST', url.searchParams.get('host') || decodeURIComponent(url.hostname.replace(/^\[|\]$/g, '')));
    assign('PGPORT', url.searchParams.get('port') || url.port);
    assign('PGUSER', url.searchParams.get('user') || decodeURIComponent(url.username));
    assign('PGDATABASE', url.searchParams.get('dbname') || decodeURIComponent(url.pathname.slice(1)));
    assign('PGPASSWORD', url.searchParams.get('password') ?? decodeURIComponent(url.password));
    for (const [param, key] of Object.entries({ sslmode: 'PGSSLMODE', sslcert: 'PGSSLCERT', sslkey: 'PGSSLKEY',
      sslrootcert: 'PGSSLROOTCERT', sslcrl: 'PGSSLCRL', options: 'PGOPTIONS', connect_timeout: 'PGCONNECT_TIMEOUT' })) {
      assign(key, url.searchParams.get(param));
    }
    if (url.searchParams.get('ssl') === 'true' && !url.searchParams.has('sslmode')) {
      env.PGSSLMODE = 'verify-full';
      env.PGSSLROOTCERT ||= process.env.SSL_CERT_FILE || '/etc/ssl/certs/ca-certificates.crt';
    }
    return env;
  }

  protected async runTool(program: string, args: string[], timeout = 30000) {
    return execFileAsync(program, args, { env: this.toolEnvironment(), timeout,
      maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' });
  }

  private async ensureTools() {
    if (Date.now() - this.toolsCheckedAt < 60000) return;
    try {
      const [{ rows: [server] }, ...tools] = await Promise.all([
        this.database.getPool().query('SHOW server_version_num'),
        ...['pg_dump', 'pg_restore', 'psql'].map(tool => this.runTool(tool, ['--version'])),
      ]);
      const major = Math.floor(Number(server.server_version_num) / 10000);
      if (tools.some(tool => Number(tool.stdout.match(/PostgreSQL\) (\d+)/)?.[1]) !== major)) {
        throw new Error('version mismatch');
      }
      this.toolsCheckedAt = Date.now();
    } catch {
      throw new ServiceUnavailableException('Install pg_dump, pg_restore, and psql matching the PostgreSQL server major version.');
    }
  }

  private async otherClients(client: any, allowOwnActive = false) {
    const { rows: [result] } = await client.query(`SELECT count(*)::int AS count FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid() AND backend_type = 'client backend'
      AND ((application_name IS DISTINCT FROM $1 AND application_name IS DISTINCT FROM $2)
        OR (NOT $3 AND state IS DISTINCT FROM 'idle'))`,
      [databaseApplicationName(), databaseApplicationName('jobs'), allowOwnActive]);
    return result.count > 0;
  }

  async getStatus() {
    let unavailableReason: string | null = null;
    let retentionDays = 7;
    try { this.ensureStorage(); retentionDays = this.defaultRetentionDays(); await this.ensureTools(); }
    catch (error: any) { unavailableReason = error.message; }
    const client = await this.database.getPool().connect();
    let busy = false;
    let restoreUnavailableReason = unavailableReason;
    try {
      // Observe the operation lock without taking it: simultaneous status reads
      // must not appear to each other as a running backup.
      const { rows: [lock] } = await client.query(`SELECT EXISTS (
        SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND granted
        AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
        AND classid = 0 AND objid = $1::oid AND objsubid = 1) AS busy`, [BACKUP_LOCK]);
      busy = lock.busy;
      if (!restoreUnavailableReason && await this.otherClients(client, true)) {
        restoreUnavailableReason = 'Stop CRM workers and other database clients before restoring.';
      }
    } finally { client.release(); }
    return { scope: 'database' as const, retentionDays, scheduling: 'external' as const, busy,
      creationAvailable: !unavailableReason && !busy, unavailableReason,
      restoreAvailable: !restoreUnavailableReason && !busy, restoreUnavailableReason };
  }

  private async withOperation<T>(operation: 'backup' | 'restore', fn: () => Promise<T>): Promise<T> {
    const url = new URL(this.configService.getOrThrow<string>('DATABASE_URL'));
    url.searchParams.set('application_name', databaseApplicationName());
    const client = new Client({ connectionString: url.toString() });
    client.on('error', () => this.logger.warn('Backup operation lock connection failed'));
    await client.connect();
    let acquired = false;
    try {
      const { rows: [lock] } = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [BACKUP_LOCK]);
      acquired = lock.acquired;
      if (!acquired) throw new ConflictException('Another backup, restore, or deletion is already running.');
      return await fn();
    } finally {
      try { if (acquired) await client.query('SELECT pg_advisory_unlock($1)', [BACKUP_LOCK]); }
      catch { this.logger.warn('Backup lock connection closed before explicit unlock'); }
      finally {
        try { await client.end(); }
        catch { this.logger.warn('Backup lock connection was already closed'); }
      }
    }
  }

  private createdAt(filename: string, stats: fs.Stats) {
    const m = filename.match(/^crm_db_(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/);
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +m[7])) : stats.mtime;
  }

  listBackups(): BackupInfo[] {
    this.ensureStorage();
    return fs.readdirSync(this.backupDir).filter(filename => SAFE_FILENAME.test(filename) && !filename.includes('..'))
      .flatMap(filename => {
        try {
          const stats = fs.lstatSync(path.join(this.backupDir, filename));
          return stats.isFile() && stats.size > 0 ? [{ filename, size: stats.size, created: this.createdAt(filename, stats) }] : [];
        } catch (error: any) { if (error.code === 'ENOENT') return []; throw error; }
      }).sort((a, b) => b.created.getTime() - a.created.getTime() || b.filename.localeCompare(a.filename));
  }

  getBackupFilePath(filename: string) {
    if (filename.length > 255 || !SAFE_FILENAME.test(filename) || filename.includes('..')) throw new BadRequestException('Invalid backup filename');
    this.ensureStorage();
    const filepath = path.join(this.backupDir, filename);
    let stats: fs.Stats;
    try { stats = fs.lstatSync(filepath); }
    catch (error: any) { if (error.code === 'ENOENT') throw new NotFoundException('Backup file not found'); throw error; }
    if (!stats.isFile()) throw new BadRequestException('Backup must be a regular file, not a symlink or directory');
    return filepath;
  }

  openBackup(filename: string) {
    const filepath = this.getBackupFilePath(filename);
    let fd: number;
    try { fd = fs.openSync(filepath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); }
    catch { throw new NotFoundException('Backup file is unavailable'); }
    if (!fs.fstatSync(fd).isFile()) { fs.closeSync(fd); throw new BadRequestException('Invalid backup file'); }
    return { stream: fs.createReadStream(filepath, { fd, autoClose: true }), size: fs.fstatSync(fd).size };
  }

  private temporaryFile(extension: string) {
    this.ensureStorage();
    const filepath = path.join(this.backupDir, `.backup-${randomUUID()}.${extension}`);
    fs.closeSync(fs.openSync(filepath, 'wx', 0o600));
    return filepath;
  }

  private removeScratch(filepath: string) {
    try { fs.rmSync(filepath, { force: true }); }
    catch { this.logger.warn('Could not remove a private backup scratch file'); }
  }

  private publish(filepath: string) {
    const filename = `crm_db_${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.dump`;
    fs.linkSync(filepath, path.join(this.backupDir, filename));
    return filename;
  }

  private async validateArchive(filepath: string) {
    try { await this.runTool('pg_restore', ['--list', filepath]); }
    catch { throw new BadRequestException('Backup archive is corrupt or unsupported; no database changes were made.'); }
  }

  private async writeArchive(): Promise<BackupResult> {
    const start = Date.now();
    const temporary = this.temporaryFile('partial');
    try {
      await this.runTool('pg_dump', ['--no-password', '--format=custom', '--compress=6',
        '--schema=public', '--schema=drizzle', `--file=${temporary}`], 180000);
      await this.validateArchive(temporary);
      const file = this.publish(temporary);
      return { file, size: fs.statSync(path.join(this.backupDir, file)).size, duration: Date.now() - start };
    } finally { this.removeScratch(temporary); }
  }

  private async recordJob(jobType: string, status: string, payload: any, result?: any) {
    try {
      await this.database.db.insert(jobLogs).values({ jobType, status, payload, result,
        error: status === 'failed' ? String(result?.error || 'Backup failed') : undefined, completedAt: new Date() });
    } catch { this.logger.warn('Could not write the backup operation job log'); }
  }

  async createBackup(retentionDays = this.defaultRetentionDays()): Promise<BackupResult> {
    this.validateRetention(retentionDays);
    await this.ensureTools();
    return this.withOperation('backup', async () => {
      try {
        const result = await this.writeArchive();
        try { await this.cleanupOldBackups(retentionDays, result.file); }
        catch { result.warnings = 'Backup created, but old backups could not be removed.'; }
        await this.recordJob('backup-database', 'completed', { retentionDays }, result);
        return result;
      } catch (error: any) {
        await this.recordJob('backup-database', 'failed', { retentionDays }, { error: 'PostgreSQL backup failed' });
        this.logger.error(`Backup failed (${error.code || 'archive error'})`);
        throw new ServiceUnavailableException('Database backup failed. Check PostgreSQL tools, disk space, and server logs.');
      }
    });
  }

  async importBackup(sourcePath: string): Promise<BackupResult> {
    if (!/\.(sql|dump)\.gz$/.test(sourcePath) && !sourcePath.endsWith('.dump')) {
      throw new BadRequestException('Import a PostgreSQL custom .dump or legacy .sql.gz backup');
    }
    await this.ensureTools();
    return this.withOperation('backup', async () => {
      const temporary = this.temporaryFile('partial');
      const start = Date.now();
      try {
        const destination = fs.createWriteStream(temporary, { mode: 0o600 });
        if (/\.(sql|dump)\.gz$/.test(sourcePath)) await pipeline(fs.createReadStream(sourcePath), createGunzip(), destination);
        else await pipeline(fs.createReadStream(sourcePath), destination);
        await this.validateArchive(temporary);
        const file = this.publish(temporary);
        const result = { file, size: fs.statSync(temporary).size, duration: Date.now() - start };
        await this.recordJob('backup-database', 'completed', { imported: true }, result);
        return result;
      } finally { this.removeScratch(temporary); }
    });
  }

  async getBackupStats() {
    const backups = this.listBackups();
    const [lastJob] = await this.database.db.select().from(jobLogs).where(eq(jobLogs.jobType, 'backup-database'))
      .orderBy(desc(jobLogs.createdAt), desc(jobLogs.id)).limit(1);
    return { totalBackups: backups.length, latestBackup: backups[0] || null,
      lastJobStatus: lastJob?.status || null, lastJobError: lastJob?.error || null };
  }

  async cleanupOldBackups(retentionDays: number, keepFilename?: string) {
    this.validateRetention(retentionDays);
    const cutoff = Date.now() - retentionDays * 86400000;
    let deleted = 0;
    for (const backup of this.listBackups()) {
      if (backup.filename !== keepFilename && backup.created.getTime() < cutoff) {
        fs.unlinkSync(this.getBackupFilePath(backup.filename));
        deleted++;
      }
    }
    return deleted;
  }

  async deleteBackup(filename: string) {
    return this.withOperation('backup', async () => { fs.unlinkSync(this.getBackupFilePath(filename)); });
  }

  private cleanupSql() {
    const tables = Object.values(schema).filter(value => is(value, PgTable)) as PgTable[];
    const checks = tables.map(table => {
      const config = getTableConfig(table);
      return `SELECT ${config.columns.map(column => quote(column.name)).join(', ')} FROM public.${quote(config.name)} LIMIT 0;`;
    }).join('\n');
    return `\n${checks}
DO $restore$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."User" WHERE role = 'ADMIN' AND "isActive" = true) THEN
    RAISE EXCEPTION 'Backup contains no active administrator';
  END IF;
END $restore$;
DELETE FROM public."RefreshSession";
UPDATE public."OutboxEvent" SET published = true, "publishedAt" = now(), "lastError" = 'Not replayed after restore' WHERE published = false;
UPDATE public."IvrWebhookEvent" SET status = 'failed', error = 'Restored event: review and retry explicitly', "processedAt" = now()
  WHERE status IN ('pending', 'processing', 'failed');
DO $restore$ BEGIN
  IF to_regclass('pgboss.job') IS NOT NULL THEN EXECUTE 'TRUNCATE pgboss.job CASCADE'; END IF;
  IF to_regclass('pgboss.schedule') IS NOT NULL THEN EXECUTE 'DELETE FROM pgboss.schedule'; END IF;
  IF to_regclass('pgboss.subscription') IS NOT NULL THEN EXECUTE 'DELETE FROM pgboss.subscription'; END IF;
END $restore$;\n`;
  }

  async restoreBackup(filename: string): Promise<RestoreResult> {
    const filepath = this.getBackupFilePath(filename);
    await this.ensureTools();
    await this.validateArchive(filepath);
    return this.withOperation('restore', async () => {
      this.maintenance.restoring = true;
      let sqlFile: string | undefined;
      let recoveryBackup: string | undefined;
      let restoreStarted = false;
      const start = Date.now();
      try {
        await this.maintenance.drainRequests();
        const client = await this.database.getPool().connect();
        try {
          if (await this.otherClients(client)) throw new ConflictException('Stop CRM workers and other database clients before restoring.');
        } finally { client.release(); }
        recoveryBackup = (await this.writeArchive()).file;
        sqlFile = this.temporaryFile('sql');
        await this.runTool('pg_restore', ['--clean', '--if-exists', '--no-owner', '--no-privileges',
          '--schema=public', '--schema=drizzle', `--file=${sqlFile}`, filepath], 120000);
        fs.appendFileSync(sqlFile, this.cleanupSql());
        // psql commits only if restore, schema validation, session revocation and queue cleanup ALL succeed.
        restoreStarted = true;
        await this.runTool('psql', ['--no-password', '--no-psqlrc', '--quiet', '--single-transaction',
          '--set=ON_ERROR_STOP=on', `--file=${sqlFile}`], 180000);
        const result: RestoreResult = { filename, duration: Date.now() - start, recoveryBackup, requiresLogin: true };
        await this.recordJob('restore-database', 'completed', { filename }, result);
        return result;
      } catch (error: any) {
        if (error instanceof ConflictException) throw error;
        const uncertain = restoreStarted && error.code !== 3;
        await this.recordJob('restore-database', 'failed', { filename, recoveryBackup },
          { error: uncertain ? 'Restore outcome could not be confirmed' : 'PostgreSQL restore failed; transaction rolled back' });
        this.logger.error(`Restore failed (${error.code || 'archive error'})`);
        if (uncertain) throw new ServiceUnavailableException('Restore outcome could not be confirmed. Check database state and the recovery backup before retrying.');
        throw new BadRequestException('Restore failed. Current data was preserved; no partial restore was committed.');
      } finally {
        if (sqlFile) this.removeScratch(sqlFile);
        this.maintenance.restoring = false;
      }
    });
  }
}
