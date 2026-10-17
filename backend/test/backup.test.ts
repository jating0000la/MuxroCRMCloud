import 'reflect-metadata';
import { before, beforeEach, after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes, randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { Client, Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { BackupService } from '../src/common/backup/backup.service';
import { BackupMaintenanceService } from '../src/common/backup/backup-maintenance.service';
import { DatabaseService } from '../src/db/database.service';
import { AuthService } from '../src/auth/auth.service';
import { JobService } from '../src/jobs/job.service';
import { JOB_TYPES } from '../src/jobs/job.types';
import { users, campaigns, outboxEvents, jobLogs, ivrWebhookEvents } from '../src/db/schema';

// All destructive operations target a database and directory owned by this test run.
const baseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const name = `muxro_backup_test_${randomUUID().replace(/-/g, '')}`;
const directory = fs.mkdtempSync(path.join(tmpdir(), 'muxro-backup-test-'));
const password = 'BackupFixture123';
let root: Pool;
let app: INestApplication;
let database: DatabaseService;
let backups: BackupService;
let maintenance: BackupMaintenanceService;
let config: ConfigService;
let auth: AuthService;
let api: string;
let created = false;
let passwordHash: string;
let adminToken: string;
let memberToken: string;

before(async () => {
  assert.ok(baseUrl, 'Set TEST_DATABASE_URL or DATABASE_URL to a development PostgreSQL URL with CREATE DATABASE permission');
  root = new Pool({ connectionString: baseUrl });
  await root.query(`CREATE DATABASE "${name}"`);
  created = true;
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  process.env.DATABASE_URL = url.toString();
  process.env.BACKUP_DIR = directory;
  process.env.BACKUP_RETENTION_DAYS = '7';
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  process.env.ENCRYPTION_SALT = randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'development';
  delete process.env.CRM_PROCESS_ROLE;
  const init = new Pool({ connectionString: url.toString() });
  try {
    for (const file of ['0000_acoustic_tarot.sql', '0001_whatsapp_tables.sql', '0003_round_robin_cursor.sql', '0004_open_titanium_man.sql', '0005_clumsy_sunspot.sql', '0006_famous_cardiac.sql']) {
      await init.query(fs.readFileSync(path.join(__dirname, '../drizzle', file), 'utf8'));
    }
    // A common production extension must not break an otherwise valid restore.
    await init.query('CREATE EXTENSION IF NOT EXISTS pg_stat_statements');
  } finally { await init.end(); }
  const { AppModule } = require('../src/app.module');
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });
  app.use(require('cookie-parser')());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true } }));
  await app.listen(0, '127.0.0.1');
  api = (await app.getUrl()) + '/api/v1';
  database = app.get(DatabaseService);
  backups = app.get(BackupService);
  maintenance = app.get(BackupMaintenanceService);
  config = app.get(ConfigService);
  auth = app.get(AuthService);
  passwordHash = await bcrypt.hash(password, 10);
});

beforeEach(async () => {
  maintenance.restoring = false;
  await database.getPool().query('TRUNCATE "User", "Campaign", "OutboxEvent", "JobLog" CASCADE');
  await database.getPool().query('TRUNCATE pgboss.job CASCADE');
  for (const file of fs.readdirSync(directory)) fs.rmSync(path.join(directory, file), { recursive: true, force: true });
  await database.db.insert(users).values([
    { username: 'admin', name: 'Backup Admin', role: 'ADMIN', password: passwordHash },
    { username: 'member', name: 'Backup Member', role: 'USER', password: passwordHash },
  ]);
  adminToken = (await auth.login({ username: 'admin', password })).access_token;
  memberToken = (await auth.login({ username: 'member', password })).access_token;
});

after(async () => {
  if (app) await app.close();
  if (created) {
    const deadline = Date.now() + 5000;
    while (Number((await root.query('SELECT count(*) FROM pg_stat_activity WHERE datname = $1', [name])).rows[0].count) > 0) {
      assert.ok(Date.now() < deadline, 'Test database connections did not close');
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    await root.query(`DROP DATABASE "${name}"`);
  }
  if (root) await root.end();
  fs.rmSync(directory, { recursive: true, force: true });
});

const request = (route: string, method = 'GET', body?: any, token = adminToken) => fetch(api + route, {
  method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const count = async (table: string) => Number((await database.getPool().query(`SELECT count(*) FROM "${table}"`)).rows[0].count);
const failure = (status: number) => (error: any) => error?.getStatus?.() === status;

test('every backup endpoint enforces class-level ADMIN permissions', async () => {
  for (const [route, method, body] of [
    ['/admin/backups', 'GET'], ['/admin/backups/status', 'GET'],
    ['/admin/backups/trigger', 'POST', {}], ['/admin/backups/test.dump/download', 'GET'],
    ['/admin/backups/test.dump', 'DELETE'], ['/admin/backups/test.dump/restore', 'POST', { confirmation: 'RESTORE' }],
  ] as [string, string, any?][]) {
    assert.equal((await request(route, method, body, memberToken)).status, 403, `${method} ${route}`);
  }
  assert.equal(backups.listBackups().length, 0);
  assert.equal((await request('/admin/backups', 'GET', undefined, '')).status, 401);
});

test('HTTP validates retention and explicit restore confirmation before touching data', async () => {
  for (const retentionDays of [0, -1, 366, 1.5, '7', true, null]) {
    assert.equal((await request('/admin/backups/trigger', 'POST', { retentionDays })).status, 400);
  }
  for (const body of [{}, { confirmation: 'yes' }, { confirmation: 'restore' }, { confirmation: true },
    { confirmation: 'RESTORE', unexpected: true }]) {
    assert.equal((await request('/admin/backups/test.dump/restore', 'POST', body)).status, 400);
  }
  assert.equal(backups.listBackups().length, 0);
  assert.equal(await count('User'), 2);
});

test('native backup, catalog, byte-exact HTTP download, stats and deletion agree', async () => {
  const response = await request('/admin/backups/trigger', 'POST', { retentionDays: 7 });
  assert.equal(response.status, 201);
  const result: any = await response.json();
  const archive = fs.readFileSync(path.join(directory, result.file));
  assert.equal(archive.subarray(0, 5).toString(), 'PGDMP');
  assert.equal(result.size, archive.length);
  assert.equal(fs.statSync(path.join(directory, result.file)).mode & 0o777, 0o600);
  const catalog: any = await (await request('/admin/backups')).json();
  assert.equal(catalog[0].filename, result.file);
  assert.equal(catalog[0].size, archive.length);
  assert.ok(Number.isFinite(Date.parse(catalog[0].created)));
  const download = await request(`/admin/backups/${result.file}/download`);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), archive);
  const stats = await backups.getBackupStats();
  assert.equal(stats.lastJobStatus, 'completed');
  assert.equal(stats.totalBackups, 1);
  const status: any = await (await request('/admin/backups/status')).json();
  assert.equal(status.scope, 'database');
  assert.equal(status.scheduling, 'external');
  assert.equal(status.retentionDays, 7);
  assert.equal(status.creationAvailable, true);
  const parallel = await Promise.all(Array.from({ length: 4 }, async () =>
    (await request('/admin/backups/status')).json() as Promise<any>));
  assert.ok(parallel.every(result => result.busy === false && result.restoreAvailable === true),
    'Concurrent status reads must not contend on the backup lock or block each other');
  assert.equal((await request(`/admin/backups/${result.file}`, 'DELETE')).status, 200);
  assert.equal((await request(`/admin/backups/${result.file}/download`)).status, 404);
  assert.deepEqual(backups.listBackups(), []);
});

test('scratch files, symlinks, directories and traversal are excluded', async () => {
  fs.writeFileSync(path.join(directory, '.backup-private.partial'), 'private');
  fs.writeFileSync(path.join(directory, '.restore-private.dump'), 'private');
  fs.writeFileSync(path.join(directory, 'empty.dump'), '');
  fs.mkdirSync(path.join(directory, 'directory.dump'));
  fs.symlinkSync(path.join(directory, '.backup-private.partial'), path.join(directory, 'link.dump'));
  assert.deepEqual(backups.listBackups(), []);
  for (const filename of ['../test.dump', 'a..dump', 'link.dump', 'directory.dump']) {
    assert.throws(() => backups.getBackupFilePath(filename), failure(400));
  }
});

test('retention uses backup creation timestamp and newest job wins in stats', async () => {
  const old = 'crm_db_2000-01-01T00-00-00-000Z-old.dump';
  fs.writeFileSync(path.join(directory, old), 'old');
  fs.utimesSync(path.join(directory, old), new Date(), new Date());
  fs.writeFileSync(path.join(directory, 'recent.dump'), 'recent');
  await database.db.insert(jobLogs).values([
    { jobType: 'backup-database', status: 'completed', createdAt: new Date('2000-01-01') },
    { jobType: 'backup-database', status: 'failed', error: 'Fixture failure', createdAt: new Date() },
  ]);
  assert.equal((await backups.getBackupStats()).lastJobStatus, 'failed');
  assert.equal((await backups.getBackupStats()).lastJobError, 'Fixture failure');
  assert.equal(await backups.cleanupOldBackups(7), 1);
  assert.equal(fs.existsSync(path.join(directory, 'recent.dump')), true);
});

test('database lock rejects concurrent backup, delete and restore operations', async () => {
  const snapshot = await backups.createBackup();
  const lock = new Client({ connectionString: process.env.DATABASE_URL });
  await lock.connect();
  try {
    await lock.query('SELECT pg_advisory_lock(1465078355)');
    assert.equal((await backups.getStatus()).busy, true);
    await assert.rejects(() => backups.createBackup(), failure(409));
    await assert.rejects(() => backups.deleteBackup(snapshot.file), failure(409));
    await assert.rejects(() => backups.restoreBackup(snapshot.file), failure(409));
  } finally { await lock.end(); }
  assert.equal(backups.listBackups().length, 1);
});

test('failed pg_dump never publishes a partial file and records failure', async () => {
  class FailedDump extends BackupService {
    protected async runTool(program: string, args: string[], timeout?: number) {
      if (program === 'pg_dump' && args.some(arg => arg.startsWith('--file='))) {
        fs.writeFileSync(args.find(arg => arg.startsWith('--file='))!.slice(7), 'partial');
        throw new Error('Fixture interrupted dump');
      }
      return super.runTool(program, args, timeout);
    }
  }
  const failing = new FailedDump(config, database, maintenance);
  await assert.rejects(() => failing.createBackup(), failure(503));
  assert.deepEqual(fs.readdirSync(directory), []);
  assert.equal((await backups.getBackupStats()).lastJobStatus, 'failed');
});

test('worker connections disable restore and return conflict without mutations', async () => {
  const snapshot = await backups.createBackup();
  const worker = new Client({ connectionString: process.env.DATABASE_URL, application_name: 'fixture-worker' });
  await worker.connect();
  try {
    assert.equal((await backups.getStatus()).restoreAvailable, false);
    await assert.rejects(() => backups.restoreBackup(snapshot.file), failure(409));
    assert.equal(backups.listBackups().length, 1);
    assert.equal(await count('User'), 2);
  } finally { await worker.end(); }
  assert.equal(maintenance.restoring, false);
});

test('corrupt archives fail before creating recovery or changing data', async () => {
  fs.writeFileSync(path.join(directory, 'corrupt.dump'), 'invalid archive');
  await assert.rejects(() => backups.restoreBackup('corrupt.dump'), failure(400));
  assert.equal(await count('User'), 2);
  assert.equal(backups.listBackups().length, 1);
  assert.equal((await request('/auth/profile')).status, 200);
});

test('real HTTP restore creates recovery, restores records, clears sessions and queued work', async () => {
  const [snapshotCampaign] = await database.db.insert(campaigns).values({ name: 'Snapshot campaign' }).returning();
  await database.db.insert(outboxEvents).values({ aggregateType: 'fixture', aggregateId: '1', eventType: 'fixture', payload: {} });
  await database.db.insert(ivrWebhookEvents).values([
    { eventKey: 'restore-pending', tenantId: 'restore-fixture', externalCallId: 'call-1', crmCampaignId: snapshotCampaign.id,
      payload: {}, status: 'pending' },
    { eventKey: 'restore-failed', tenantId: 'restore-fixture', externalCallId: 'call-2', crmCampaignId: snapshotCampaign.id,
      payload: {}, status: 'failed', error: 'Previous failure' },
    { eventKey: 'restore-processed', tenantId: 'restore-fixture', externalCallId: 'call-3', crmCampaignId: snapshotCampaign.id,
      payload: {}, status: 'processed', processedAt: new Date('2026-01-01T00:00:00Z') },
  ]);
  const snapshot = await backups.createBackup();
  await database.getPool().query('UPDATE "Campaign" SET name = $1', ['Current campaign']);
  await app.get(JobService).addJob(JOB_TYPES.BACKUP_DATABASE, { fixture: true });
  const bulk = await app.get(JobService).addBulkJobs(JOB_TYPES.BACKUP_DATABASE, [{ fixture: 'bulk' }], { retryLimit: 1, priority: 2 });
  assert.equal(bulk.length, 1);
  const queued = (await database.getPool().query('SELECT priority, retry_limit FROM pgboss.job WHERE id = $1', [bulk[0]])).rows[0];
  assert.equal(queued.priority, 2);
  assert.equal(queued.retry_limit, 1);
  assert.ok(Number((await database.getPool().query('SELECT count(*) FROM pgboss.job')).rows[0].count) > 0);
  const response = await request(`/admin/backups/${snapshot.file}/restore`, 'POST', { confirmation: 'RESTORE' });
  const result: any = await response.json();
  assert.equal(response.status, 201, JSON.stringify(result));
  assert.equal(result.requiresLogin, true);
  assert.ok(fs.existsSync(path.join(directory, result.recoveryBackup)));
  assert.equal((await database.getPool().query('SELECT name FROM "Campaign"')).rows[0].name, 'Snapshot campaign');
  assert.equal(await count('RefreshSession'), 0);
  assert.equal((await request('/auth/profile')).status, 401);
  assert.equal((await request('/auth/profile', 'GET', undefined, memberToken)).status, 401);
  assert.equal((await auth.login({ username: 'admin', password })).user.role, 'ADMIN');
  assert.equal(Number((await database.getPool().query('SELECT count(*) FROM pgboss.job')).rows[0].count), 0);
  assert.equal((await database.getPool().query('SELECT published FROM "OutboxEvent"')).rows[0].published, true);
  const restoredEvents = (await database.getPool().query('SELECT "eventKey", status, error, "processedAt" FROM "IvrWebhookEvent" ORDER BY "eventKey"')).rows;
  assert.deepEqual(restoredEvents.map(row => [row.eventKey, row.status]), [
    ['restore-failed', 'failed'], ['restore-pending', 'failed'], ['restore-processed', 'processed'],
  ]);
  for (const row of restoredEvents.filter(row => row.status === 'failed')) {
    assert.equal(row.error, 'Restored event: review and retry explicitly');
    assert.ok(row.processedAt);
  }
  assert.equal(restoredEvents.find(row => row.eventKey === 'restore-processed')!.processedAt.toISOString(), '2026-01-01T00:00:00.000Z');
  const cookies = response.headers.get('set-cookie') || '';
  assert.match(cookies, /auth_token=;/);
  assert.match(cookies, /refresh_token=;/);
  assert.equal(maintenance.restoring, false);
  assert.equal(fs.readdirSync(directory).some(file => file.startsWith('.')), false);
  // Prove the recovery archive contains the immediately preceding data.
  await backups.restoreBackup(result.recoveryBackup);
  assert.equal((await database.getPool().query('SELECT name FROM "Campaign"')).rows[0].name, 'Current campaign');
});

test('SQL error during native restore rolls back records and preserves existing sessions', async () => {
  await database.db.insert(campaigns).values({ name: 'Snapshot campaign' });
  const snapshot = await backups.createBackup();
  await database.getPool().query('UPDATE "Campaign" SET name = $1', ['Current campaign']);
  class FailedRestore extends BackupService {
    protected async runTool(program: string, args: string[], timeout?: number) {
      if (program === 'psql' && args.some(arg => arg.startsWith('--file=')))
        fs.appendFileSync(args.find(arg => arg.startsWith('--file='))!.slice(7), '\nSELECT fixture_missing_function();\n');
      return super.runTool(program, args, timeout);
    }
  }
  await assert.rejects(() => new FailedRestore(config, database, maintenance).restoreBackup(snapshot.file), failure(400));
  assert.equal((await database.getPool().query('SELECT name FROM "Campaign"')).rows[0].name, 'Current campaign');
  assert.equal((await request('/auth/profile')).status, 200);
  assert.equal(backups.listBackups().length, 2, 'Recovery must remain available after a failed restore');
  assert.equal(maintenance.restoring, false);
});

test('a backup without an active administrator is rejected atomically', async () => {
  await database.getPool().query('UPDATE "User" SET "isActive" = false WHERE role = $1', ['ADMIN']);
  const invalid = await backups.createBackup();
  await database.getPool().query('UPDATE "User" SET "isActive" = true WHERE role = $1', ['ADMIN']);
  await assert.rejects(() => backups.restoreBackup(invalid.file), failure(400));
  assert.equal((await auth.login({ username: 'admin', password })).user.role, 'ADMIN');
});

test('lost confirmation after commit reports an uncertain outcome, never a false rollback', async () => {
  await database.db.insert(campaigns).values({ name: 'Snapshot campaign' });
  const snapshot = await backups.createBackup();
  await database.getPool().query('UPDATE "Campaign" SET name = $1', ['Current campaign']);
  class LostConfirmation extends BackupService {
    protected async runTool(program: string, args: string[], timeout?: number) {
      const result = await super.runTool(program, args, timeout);
      if (program === 'psql' && args.some(arg => arg.startsWith('--file='))) {
        throw Object.assign(new Error('Fixture connection lost after commit'), { code: 1 });
      }
      return result;
    }
  }
  await assert.rejects(() => new LostConfirmation(config, database, maintenance).restoreBackup(snapshot.file),
    (error: any) => error.getStatus() === 503 && /outcome could not be confirmed/.test(error.message));
  assert.equal((await database.getPool().query('SELECT name FROM "Campaign"')).rows[0].name, 'Snapshot campaign');
  assert.equal(await count('RefreshSession'), 0);
  assert.equal(backups.listBackups().length, 2);
  assert.equal(maintenance.restoring, false);
});

test('legacy gzip custom archives import into the same validated catalog without altering the source', async () => {
  const original = await backups.createBackup();
  const legacy = path.join(directory, 'legacy.sql.gz');
  const compressed = gzipSync(fs.readFileSync(path.join(directory, original.file)));
  fs.writeFileSync(legacy, compressed);
  const imported = await backups.importBackup(legacy);
  assert.deepEqual(fs.readFileSync(legacy), compressed);
  assert.equal(backups.listBackups().length, 2);
  assert.equal(imported.size, original.size);
  await backups.restoreBackup(imported.file);
  assert.equal(await count('User'), 2);
});

test('schema-incompatible snapshots roll back instead of reporting success', async () => {
  await database.getPool().query('ALTER TABLE "Lead" RENAME COLUMN name TO legacy_name');
  let snapshot: Awaited<ReturnType<BackupService['createBackup']>>;
  try { snapshot = await backups.createBackup(); }
  finally { await database.getPool().query('ALTER TABLE "Lead" RENAME COLUMN legacy_name TO name'); }
  await assert.rejects(() => backups.restoreBackup(snapshot!.file), failure(400));
  await database.getPool().query('SELECT name FROM "Lead" LIMIT 0');
  assert.equal((await request('/auth/profile')).status, 200);
});

test('archives larger than the former 50 MB stdout limit are written successfully', async () => {
  await database.getPool().query('CREATE TABLE public.backup_large_fixture (data bytea NOT NULL)');
  try {
    for (let i = 0; i < 104; i++) {
      await database.getPool().query('INSERT INTO public.backup_large_fixture VALUES ($1)', [randomBytes(512 * 1024)]);
    }
    const archive = await backups.createBackup();
    assert.ok(archive.size > 50 * 1024 * 1024);
    assert.equal(backups.listBackups()[0].size, archive.size);
    assert.equal(fs.readdirSync(directory).some(file => file.startsWith('.')), false);
  } finally { await database.getPool().query('DROP TABLE public.backup_large_fixture'); }
});

test('maintenance gates requests while keeping the public health check available', async () => {
  maintenance.restoring = true;
  try {
    assert.equal((await request('/admin/backups')).status, 503);
    assert.equal((await request('/auth/login', 'POST', { username: 'admin', password })).status, 503);
    assert.equal((await request('/health')).status, 200);
  } finally { maintenance.restoring = false; }
});

test('missing tools produce truthful availability and database URL values are decoded', async () => {
  class InspectEnvironment extends BackupService { environment() { return this.toolEnvironment(); } }
  const encoded = new InspectEnvironment(new ConfigService({ DATABASE_URL:
    'postgresql://fixture%40user:fixture%3Apass@localhost:5433/fixture%20db?sslmode=require&connect_timeout=5' }), database, maintenance).environment();
  assert.equal(encoded.PGUSER, 'fixture@user');
  assert.equal(encoded.PGPASSWORD, 'fixture:pass');
  assert.equal(encoded.PGDATABASE, 'fixture db');
  assert.equal(encoded.PGSSLMODE, 'require');
  assert.equal(encoded.PGCONNECT_TIMEOUT, '5');
  class MissingTools extends BackupService {
    protected async runTool(): Promise<{ stdout: string; stderr: string }> { throw new Error('fixture missing tool'); }
  }
  const unavailable = new MissingTools(config, database, maintenance);
  const status = await unavailable.getStatus();
  assert.equal(status.creationAvailable, false);
  assert.match(status.unavailableReason!, /matching the PostgreSQL/);
  await assert.rejects(() => unavailable.createBackup(), failure(503));
});
