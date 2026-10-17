import { settings as settingsTable } from '../src/db/schema';
import { StructuredLoggingMiddleware } from '../src/common/logging/structured-logging.middleware';
import { EventEmitter } from 'node:events';
import 'reflect-metadata';
import { before, beforeEach, after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { inflateRawSync } from 'node:zlib';
import { configureBodyLimits } from '../src/common/http-body-limits';
import { NotificationsService } from '../src/notifications/notifications.service';
import { SettingsService } from '../src/settings/settings.service';
import { spawn } from 'node:child_process';
import * as bcrypt from 'bcryptjs';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { DatabaseService } from '../src/db/database.service';
import { AuthService } from '../src/auth/auth.service';
import { WhatsAppService } from '../src/whatsapp/whatsapp.service';
import { FollowupsService } from '../src/followups/followups.service';
import { FormsService } from '../src/forms/forms.service';
import { LeadsService } from '../src/leads/leads.service';
import { RoundRobinService } from '../src/common/services/round-robin.service';
import { BulkImportService } from '../src/bulk-import/bulk-import.service';
import { DataExportService } from '../src/data-export/data-export.service';
import { parse } from 'csv-parse/sync';
import { eq } from 'drizzle-orm';
import { users, campaigns, campaignUsers, campaignStatuses, leads, followups, forms, enquiries, whatsappMessages, whatsappContacts, roundRobinCursors, notifications, ivrCalls, ivrWebhookEvents } from '../src/db/schema';

const base = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const name = `muxro_security_test_${randomUUID().replace(/-/g, '')}`;
const directory = mkdtempSync(join(tmpdir(), 'muxro-security-'));
const originalCwd = process.cwd();
const webhookToken = randomBytes(32).toString('hex');
let root: Pool, app: INestApplication, database: DatabaseService;
let api: string, passwordHash: string, adminToken: string, aliceToken: string;
let created = false;
let admin: typeof users.$inferSelect, alice: typeof users.$inferSelect, bob: typeof users.$inferSelect;
let campaign: typeof campaigns.$inferSelect, privateCampaign: typeof campaigns.$inferSelect;
let status: typeof campaignStatuses.$inferSelect, privateStatus: typeof campaignStatuses.$inferSelect;
let own: typeof leads.$inferSelect, other: typeof leads.$inferSelect;

before(async () => {
  assert.ok(base, 'Use a development PostgreSQL URL with CREATE DATABASE permission');
  root = new Pool({ connectionString: base });
  await root.query(`CREATE DATABASE "${name}"`); created = true;
  const url = new URL(base); url.pathname = `/${name}`;
  process.env.DATABASE_URL = url.toString();
  process.env.BACKUP_DIR = join(directory, 'backups');
  for (const key of ['JWT_SECRET', 'APP_ENCRYPTION_KEY', 'ENCRYPTION_SALT']) process.env[key] = randomBytes(32).toString('hex');
  process.env.GUPSHUP_WEBHOOK_TOKEN = webhookToken;
  process.env.NODE_ENV = 'development';
  delete process.env.CRM_PROCESS_ROLE;
  const init = new Pool({ connectionString: url.toString() });
  try {
    for (const file of ['0000_acoustic_tarot.sql', '0001_whatsapp_tables.sql', '0002_performance_indexes.sql', '0003_round_robin_cursor.sql', '0004_open_titanium_man.sql', '0005_clumsy_sunspot.sql', '0006_famous_cardiac.sql']) {
      await init.query(readFileSync(join(__dirname, '../drizzle', file), 'utf8'));
    }
  } finally { await init.end(); }
  process.chdir(directory); // Keep uploads out of the checkout.
  const { AppModule } = require('../src/app.module');
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });
  configureBodyLimits(app);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
  await app.listen(0, '127.0.0.1');
  api = `${await app.getUrl()}/api/v1`; database = app.get(DatabaseService);
  passwordHash = await bcrypt.hash('SecurityFixture123', 4);
});

beforeEach(async () => {
  await database.getPool().query('TRUNCATE "User", "Campaign", "Lead", "WhatsappMessage", "WhatsappContact" CASCADE');
  [admin, alice, bob] = await database.db.insert(users).values([
    { username: 'admin', name: 'Admin', role: 'ADMIN', password: passwordHash },
    { username: 'alice', name: 'Alice', role: 'USER', password: passwordHash },
    { username: 'bob', name: 'Bob', role: 'USER', password: passwordHash },
  ]).returning();
  [campaign, privateCampaign] = await database.db.insert(campaigns).values([
    { name: 'Alice campaign', managerId: admin.id }, { name: 'Private campaign', managerId: admin.id },
  ]).returning();
  await database.db.insert(campaignUsers).values([
    { campaignId: campaign.id, userId: alice.id, assignedAt: new Date('2020-01-01') },
    { campaignId: campaign.id, userId: bob.id, assignedAt: new Date('2020-01-02') },
  ]);
  [status, privateStatus] = await database.db.insert(campaignStatuses).values([
    { campaignId: campaign.id, label: 'New' }, { campaignId: privateCampaign.id, label: 'Private status' },
  ]).returning();
  [own, other] = await database.db.insert(leads).values([
    { campaignId: campaign.id, name: 'Alice lead', doerId: alice.id, phone: '919000000001', statusId: status.id },
    { campaignId: privateCampaign.id, name: 'Bob lead', doerId: bob.id, phone: '919000000002', statusId: privateStatus.id },
  ]).returning();
  const auth = app.get(AuthService);
  adminToken = (await auth.login({ username: 'admin', password: 'SecurityFixture123' })).access_token;
  aliceToken = (await auth.login({ username: 'alice', password: 'SecurityFixture123' })).access_token;
});

after(async () => {
  if (app) await app.close();
  process.chdir(originalCwd);
  if (created) await root.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  if (root) await root.end();
  rmSync(directory, { recursive: true, force: true });
});

function request(path: string, token = aliceToken, method = 'GET', body?: unknown) {
  return fetch(api + path, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
}

test('followup creation enforces lead ownership, permits admins, and rejects deleted leads', async () => {
  const dto = { leadId: other.id, status: 'Called' };
  assert.equal((await request('/followups', aliceToken, 'POST', dto)).status, 403);
  assert.equal((await database.db.select().from(followups)).length, 0);
  assert.equal((await request('/followups', adminToken, 'POST', dto)).status, 201);
  assert.equal((await request('/followups', aliceToken, 'POST', { ...dto, leadId: own.id })).status, 201);
  await database.db.update(leads).set({ isDeleted: true }).where(eq(leads.id, own.id));
  assert.equal((await request('/followups', aliceToken, 'POST', { ...dto, leadId: own.id })).status, 404);
});

test('WhatsApp reads isolate owners and shared phones, while admins retain access', async () => {
  await database.db.insert(whatsappMessages).values([
    { phone: own.phone!, leadId: own.id, message: 'Own', direction: 'in', status: 'received' },
    { phone: other.phone!, leadId: other.id, message: 'Private', direction: 'in', status: 'received' },
    { phone: own.phone!, leadId: other.id, message: 'Same phone, other lead', direction: 'in' },
    { phone: own.phone!, message: 'Legacy own', direction: 'out' },
  ]);
  await database.db.insert(whatsappContacts).values([
    { phone: own.phone!, leadId: own.id, name: 'Own' }, { phone: other.phone!, leadId: other.id, name: 'Private' },
  ]);
  const chats = await (await request('/whatsapp/chats')).json() as any[];
  assert.equal(chats.length, 1); assert.equal(chats[0].phone, own.phone); assert.equal(chats[0].unreadCount, 1);
  const messages = await (await request(`/whatsapp/chats/${own.phone}/messages`)).json() as any[];
  assert.deepEqual(new Set(messages.map(m => m.message)), new Set(['Own', 'Legacy own']));
  assert.deepEqual(await (await request(`/whatsapp/chats/${other.phone}/messages`)).json(), []);
  assert.equal((await (await request('/whatsapp/stats')).json() as any).totalMessages, 2);
  assert.equal((await (await request('/whatsapp/contacts')).json() as any[]).length, 1);
  assert.equal((await (await request('/whatsapp/stats', adminToken)).json() as any).totalMessages, 4);
  const [shared] = await database.db.insert(leads).values({ campaignId: campaign.id, name: 'Shared phone', phone: own.phone, doerId: bob.id }).returning();
  assert.deepEqual((await (await request(`/whatsapp/chats/${own.phone}/messages`)).json() as any[]).map(m => m.message), ['Own']);
  await database.db.update(leads).set({ isDeleted: true }).where(eq(leads.id, shared.id));
  assert.deepEqual((await (await request(`/whatsapp/chats/${own.phone}/messages`)).json() as any[]).map(m => m.message), ['Own']);
});

test('WhatsApp pagination rejects excessive, fractional, negative and malformed inputs', async () => {
  for (const path of ['/whatsapp/chats?limit=1000000', '/whatsapp/contacts?limit=1.5', '/whatsapp/chats?offset=-1', `/whatsapp/chats/${own.phone}/messages?offset=bad`]) assert.equal((await request(path)).status, 400, path);
  assert.equal((await request('/whatsapp/chats?limit=500&offset=0')).status, 200);
});

test('outgoing messages reject foreign phones and forged metadata before any provider request', async () => {
  for (const body of [
    { phone: other.phone, text: 'x' }, { phone: own.phone, leadId: other.id, text: 'x' },
    { phone: own.phone, leadId: own.id, campaignId: privateCampaign.id, text: 'x' },
  ]) assert.equal((await request('/whatsapp/send/text', aliceToken, 'POST', body)).status, 403);
});

test('dashboard conversion, alerts, totals and funnel exclude foreign owners and deleted leads', async () => {
  await database.db.insert(leads).values([
    { campaignId: campaign.id, name: 'Coworker', doerId: bob.id, statusId: status.id },
    { campaignId: campaign.id, name: 'Deleted', doerId: alice.id, statusId: status.id, isDeleted: true },
  ]);
  await database.db.update(leads).set({ updatedAt: new Date('2020-01-01') }).where(eq(leads.id, other.id));
  const conversion = await (await request('/dashboard/user-conversion')).json() as any[];
  assert.deepEqual(conversion.map(row => row.userId), [alice.id]); assert.equal(conversion[0].totalLeads, 1);
  const alerts = await (await request('/dashboard/alerts')).json() as string[];
  assert.ok(alerts.every(a => !a.includes('Bob') && !a.includes('Private campaign') && !a.includes('7+ days')));
  const stats = await (await request(`/dashboard/campaign-stats/${campaign.id}`)).json() as any;
  assert.equal(stats.totalLeads, 1); assert.equal(stats.byStatus[0].count, 1);
  const all = await (await request(`/dashboard/campaign-stats/${campaign.id}`, adminToken)).json() as any;
  assert.equal(all.totalLeads, 2); assert.equal(all.byStatus[0].count, 2);
  assert.ok(!JSON.stringify(await (await request('/dashboard/sales-funnel')).json()).includes('Private status'));
});

test('all four webhook routes require the configured token and fail closed when unconfigured', async () => {
  for (const path of ['/whatsapp/webhook', '/whatsapp/webhook/status', '/integrations/gupshup/webhook', '/integrations/gupshup/webhook/status']) {
    for (const token of ['', 'wrong', webhookToken + 'x', webhookToken]) {
      const response = await fetch(api + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-webhook-token': token }, body: '{}' });
      assert.equal(response.status, token === webhookToken ? 200 : 401, path);
    }
  }
  delete process.env.GUPSHUP_WEBHOOK_TOKEN;
  try {
    assert.equal((await fetch(api + '/whatsapp/webhook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 503);
  } finally { process.env.GUPSHUP_WEBHOOK_TOKEN = webhookToken; }
  assert.equal((await database.db.select().from(whatsappMessages)).length, 0);
});

test('authenticated webhook aliases persist messages and delivery updates', async () => {
  for (const prefix of ['/whatsapp', '/integrations/gupshup']) {
    const messageId = randomUUID();
    const headers = { 'content-type': 'application/json', 'x-webhook-token': webhookToken };
    const inbound = { type: 'message', payload: { id: messageId, sender: { phone: own.phone, name: 'Sender' }, type: 'text', payload: { type: 'text', text: 'Inbound fixture' } } };
    assert.equal((await fetch(api + prefix + '/webhook', { method: 'POST', headers, body: JSON.stringify(inbound) })).status, 200);
    let [message] = await database.db.select().from(whatsappMessages).where(eq(whatsappMessages.messageId, messageId));
    assert.equal(message.message, 'Inbound fixture'); assert.equal(message.leadId, own.id);
    const delivered = { type: 'message-event', payload: { id: messageId, type: 'DELIVERED' } };
    const rejected = await fetch(api + prefix + '/webhook/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(delivered) });
    assert.equal(rejected.status, 401);
    assert.equal((await database.db.select().from(whatsappMessages).where(eq(whatsappMessages.messageId, messageId)))[0].status, 'received');
    assert.equal((await fetch(api + prefix + '/webhook/status', { method: 'POST', headers, body: JSON.stringify(delivered) })).status, 200);
    [message] = await database.db.select().from(whatsappMessages).where(eq(whatsappMessages.messageId, messageId));
    assert.equal(message.status, 'delivered');
  }
});

test('logo uploads reject active content and spoofing, enforce size, and serve raster images safely', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHosAAAAASUVORK5CYII=', 'base64');
  async function upload(filename: string, type: string, bytes: Buffer) {
    const data = new FormData(); data.append('file', new Blob([new Uint8Array(bytes)], { type }), filename);
    return fetch(api + '/settings/logo/upload', { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: data });
  }
  for (const [filename, mime, content] of [
    ['logo.svg', 'image/svg+xml', Buffer.from('<svg onload="alert(1)"/>')],
    ['logo.html', 'image/png', Buffer.from('<script>alert(1)</script>')],
    ['logo.png', 'image/png', Buffer.from('<script>alert(1)</script>')], ['logo.jpg', 'image/jpeg', png],
  ] as const) assert.equal((await upload(filename, mime, content)).status, 400);
  assert.equal((await upload('large.png', 'image/png', Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]))).status, 413);
  const valid = await upload('valid.png', 'image/png', png); assert.equal(valid.status, 201);
  const image = await request(`/logo/${(await valid.json() as any).fileName}`);
  assert.equal(image.status, 200); assert.match(image.headers.get('content-type')!, /^image\/png/);
  assert.equal(image.headers.get('x-content-type-options'), 'nosniff'); assert.match(image.headers.get('content-security-policy')!, /sandbox/);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
});

test('status DTOs prevent mass assignment and cross-campaign update/delete', async () => {
  const path = `/campaigns/${campaign.id}/statuses/${status.id}`;
  for (const body of [{ campaignId: privateCampaign.id }, { id: privateStatus.id }, { label: '   ' }, { label: null }]) assert.equal((await request(path, adminToken, 'PUT', body)).status, 400);
  const foreign = `/campaigns/${privateCampaign.id}/statuses/${status.id}`;
  assert.equal((await request(foreign, adminToken, 'PUT', { label: 'Changed' })).status, 404);
  assert.equal((await request(foreign, adminToken, 'DELETE')).status, 404);
  assert.equal((await request(path, adminToken, 'PUT', { label: ' Contacted ' })).status, 200);
  const [updated] = await database.db.select().from(campaignStatuses).where(eq(campaignStatuses.id, status.id));
  assert.equal(updated.label, 'Contacted'); assert.equal(updated.campaignId, campaign.id);
});

test('public form, import and allocation DTOs reject malformed bodies and unknown properties', async () => {
  for (const [path, body] of [
    ['/forms/public/test/submit', { data: [], rogue: true }],
    [`/leads/bulk-allocate/${campaign.id}`, { leadIds: [own.id], campaignId: privateCampaign.id }],
    [`/leads/bulk-allocate/${campaign.id}`, { leadIds: [own.id, own.id] }],
    [`/campaigns/${campaign.id}/bulk-import/json`, { data: [null] }],
    [`/campaigns/${campaign.id}/bulk-import/json`, { data: [], rogue: true }],
  ] as const) assert.equal((await request(path, adminToken, 'POST', body)).status, 400, path);
});

test('all backend CSV writers neutralize formulas and preserve quoting', () => {
  const exporter = app.get(DataExportService) as any;
  for (const value of ['=1+1', '+SUM(1,2)', '-2+3', '@SUM(1)', '\t=1', '\r=1', '\n=1', 'hello,"world"']) {
    const expected = /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
    for (const csv of [exporter.buildLeadsCsv([{ name: value }]), exporter.buildFollowupsCsv([{ remarks: value }]), exporter.buildFormResponsesCsv([{ data: { name: value } }])]) {
      assert.ok(parse(csv)[1].includes(expected));
    }
  }
});

test('foreign or deleted allocation targets roll back assignments and cursor', async () => {
  const service = app.get(RoundRobinService);
  await assert.rejects(service.allocateRoundRobin(campaign.id, [own.id, other.id]), /Every lead/);
  assert.equal((await database.db.select().from(leads).where(eq(leads.id, own.id)))[0].doerId, alice.id);
  assert.equal((await database.db.select().from(roundRobinCursors)).length, 0);
  await database.db.update(leads).set({ isDeleted: true }).where(eq(leads.id, own.id));
  await assert.rejects(service.allocateRoundRobin(campaign.id, [own.id]), /Every lead/);
});

test('concurrent manual creation stays balanced and excludes inactive users', async () => {
  await database.db.delete(leads).where(eq(leads.id, own.id));
  const service = app.get(LeadsService);
  const created = await Promise.all(Array.from({ length: 10 }, (_, i) => service.create({ campaignId: campaign.id, name: `Concurrent ${i}` }, admin.id, 'ADMIN')));
  assert.equal(created.filter(lead => lead.doerId === alice.id).length, 5); assert.equal(created.filter(lead => lead.doerId === bob.id).length, 5);
  await database.db.update(users).set({ isActive: false }).where(eq(users.id, bob.id));
  assert.equal((await service.create({ campaignId: campaign.id, name: 'Active only' }, admin.id, 'ADMIN')).doerId, alice.id);
});

test('concurrent form submissions finish on the existing pool and allocate evenly', async () => {
  await database.db.delete(leads).where(eq(leads.id, own.id));
  await database.db.insert(forms).values({ campaignId: campaign.id, title: 'Form', publicSlug: 'security-form', isPublished: true, fields: [{ name: 'name', type: 'text', required: true }] });
  const service = app.get(FormsService);
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) => service.submitForm('security-form', { name: `Form ${i}` })));
  assert.equal(results.filter(result => result.lead.doerId === alice.id).length, 5); assert.equal(results.filter(result => result.lead.doerId === bob.id).length, 5);
  assert.equal((await database.db.select().from(enquiries)).length, 10);
});

test('failed bulk allocation is atomic and both formats enforce the row cap', async () => {
  const service = app.get(BulkImportService);
  await database.db.update(users).set({ isActive: false });
  await assert.rejects(service.importFromJSON(campaign.id, [{ name: 'Import', phone: '9000000001' }]), /No telecaller/);
  assert.equal((await database.db.select().from(leads)).length, 2); assert.equal((await database.db.select().from(followups)).length, 0);
  await assert.rejects(service.importFromCSV(campaign.id, Buffer.from('name\n' + 'Example\n'.repeat(5001))), /Maximum 5000/);
  await assert.rejects(service.importFromJSON(campaign.id, Array(5001).fill({ name: 'Example' })), /5000/);
});

test('bulk imports preserve literal false allocation options in JSON and multipart CSV', async () => {
  await database.db.update(users).set({ isActive: false }).where(eq(users.id, bob.id));
  const path = `/campaigns/${campaign.id}/bulk-import`;
  const json = await request(path + '/json', adminToken, 'POST', { data: [{ name: 'Unassigned JSON', phone: '9000000001' }], allocateRoundRobin: false });
  assert.equal(json.status, 201, await json.clone().text());
  assert.equal((await json.json() as any).leads[0].doerId, null);
  const multipart = new FormData();
  multipart.append('file', new Blob(['name,phone\nUnassigned CSV,9000000002\n'], { type: 'text/csv' }), 'leads.csv');
  multipart.append('allocateRoundRobin', 'false');
  const csv = await fetch(api + path + '/csv', { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: multipart });
  assert.equal(csv.status, 201, await csv.clone().text());
  assert.equal((await csv.json() as any).leads[0].doerId, null);
  const assigned = await request(path + '/json', adminToken, 'POST', { data: [{ name: 'Assigned JSON', phone: '9000000003' }] });
  assert.equal(assigned.status, 201);
  assert.equal((await assigned.json() as any).leads[0].doerId, alice.id);
});

test('lead writes reject foreign statuses and remarks-only updates succeed', async () => {
  const service = app.get(LeadsService);
  await assert.rejects(service.create({ campaignId: campaign.id, name: 'Foreign', statusId: privateStatus.id }, admin.id, 'ADMIN'), /Status does not belong/);
  await assert.rejects(service.update(own.id, { statusId: privateStatus.id }, alice.id, 'USER'), /Status does not belong/);
  await assert.rejects(service.updateStatus(own.id, { status: 'Called', statusId: privateStatus.id }, alice.id, 'USER'), /Status does not belong/);
  assert.equal((await database.db.select().from(followups)).length, 0);
  assert.equal((await service.updateStatus(own.id, { status: 'Called', remarks: 'Called today' }, alice.id, 'USER')).remarks, 'Called today');
});

test('the standalone worker resolves modules, registers all processors and shuts down cleanly', async () => {
  const child = spawn(process.execPath, ['-r', 'ts-node/register', 'src/worker.ts'], {
    cwd: join(__dirname, '..'), env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', ready = false;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => child.kill('SIGKILL'), 15000);
    const capture = (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-10000);
      if (!ready && output.includes('Worker started and processing jobs')) {
        ready = true;
        child.kill('SIGTERM');
      }
    };
    child.stdout.on('data', capture); child.stderr.on('data', capture);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timeout);
      if (ready && output.includes('Registered 10/10 job processors') && code === 0) resolve();
      else reject(new Error(`Worker startup/shutdown failed (exit ${code}, signal ${signal}): ${output}`));
    });
  });
});

test('merged dashboard changes keep campaign and stale-lead alerts admin-only', async () => {
  await database.db.update(leads).set({ updatedAt: new Date('2020-01-01') }).where(eq(leads.id, own.id));
  const personal = await (await request('/dashboard/alerts')).json() as string[];
  assert.ok(personal.every(alert => !alert.startsWith('Top campaign:') && !alert.includes('7+ days')));
  const global = await (await request('/dashboard/alerts', adminToken)).json() as string[];
  assert.ok(global.some(alert => alert.startsWith('Top campaign:')));
  assert.ok(global.some(alert => alert.includes('7+ days')));
});

test('merged followup user validation rejects a missing caller without inserting', async () => {
  await assert.rejects(app.get(FollowupsService).create({ leadId: own.id, status: 'Called' }, randomUUID(), 'ADMIN'), /User not found/);
  assert.equal((await database.db.select().from(followups)).length, 0);
});

test('merged service pagination caps inbox, history and contacts for internal callers', async () => {
  const service = app.get(WhatsAppService);
  await database.db.insert(whatsappMessages).values(Array.from({ length: 505 }, () => ({
    phone: own.phone!, leadId: own.id, direction: 'in', message: 'History fixture',
  })));
  assert.equal((await service.getChatMessages(own.phone!, alice.id, 'USER', 1000000)).length, 500);
  const contacts = Array.from({ length: 505 }, (_, index) => ({ phone: `9195555${String(index).padStart(4, '0')}`, leadId: own.id }));
  await database.db.insert(whatsappContacts).values(contacts);
  await database.db.insert(whatsappMessages).values(contacts.map(contact => ({ ...contact, direction: 'in', message: 'Inbox fixture' })));
  assert.equal((await service.getChats(alice.id, 'USER', 1000000)).length, 500);
  assert.equal((await service.getContacts(alice.id, 'USER', 1000000)).length, 500);
  await assert.rejects(service.getChats(alice.id, 'USER', 50, -1), /Pagination requires/);
});

async function makePublicForm() {
  const [form] = await database.db.insert(forms).values({ campaignId: campaign.id, title: 'Repair form',
    publicSlug: randomUUID(), isPublished: true, fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'attachment', label: 'Attachment', type: 'file', required: false },
    ],
  }).returning();
  return form;
}

test('repair F01/F14/F15: raw submissions are admin-only, paginated and accurately counted', async () => {
  const form = await makePublicForm();
  await database.db.insert(enquiries).values(Array.from({ length: 54 }, (_, index) => ({ formId: form.id, data: { name: `Response ${index}` } })));
  const path = `/campaigns/${campaign.id}/forms/${form.id}/submissions`;
  assert.equal((await request(path)).status, 403);
  const first = await (await request(path + '?page=1&limit=50', adminToken)).json() as any;
  const second = await (await request(path + '?page=2&limit=50', adminToken)).json() as any;
  assert.equal(first.pagination.total, 54); assert.equal(first.pagination.totalPages, 2);
  assert.equal(first.data.length, 50); assert.equal(second.data.length, 4);
  assert.ok(second.data.every((row: any) => !first.data.some((old: any) => old.id === row.id)));
  const list = await (await request(`/campaigns/${campaign.id}/forms`, adminToken)).json() as any[];
  assert.equal(list[0]._count.submissions, 54);
});

test('repair F21: nested form routes reject the wrong campaign without changing the form', async () => {
  const form = await makePublicForm(); const path = `/campaigns/${privateCampaign.id}/forms/${form.id}`;
  for (const [url, method, body] of [[path, 'GET', undefined], [path, 'PUT', { title: 'Wrong' }],
    [path + '/publish', 'POST', {}], [path + '/unpublish', 'POST', {}], [path, 'DELETE', undefined],
    [path + '/submissions', 'GET', undefined]] as const) {
    assert.equal((await request(url, adminToken, method, body)).status, 404);
  }
  assert.equal((await database.db.select().from(forms).where(eq(forms.id, form.id)))[0].title, 'Repair form');
});

test('repair F02: transfer removes old notifications and sync creates them for the new owner', async () => {
  await app.get(LeadsService).updateStatus(own.id, { status: 'Scheduled', remarks: 'Sensitive fixture', nextCallDate: new Date(Date.now() + 300000).toISOString() }, alice.id, 'USER');
  const service = app.get(NotificationsService);
  assert.equal(await service.getPendingCount(alice.id), 1);
  await app.get(LeadsService).update(own.id, { doerId: bob.id }, admin.id, 'ADMIN');
  assert.deepEqual(await service.getNotifications(alice.id), []);
  assert.equal(await service.getPendingCount(alice.id), 0);
  assert.equal((await database.db.select().from(notifications)).length, 0);
  await service.syncNotificationsForUser(alice.id);
  assert.deepEqual(await service.getPendingNotifications(alice.id), []);
  await service.syncNotificationsForUser(bob.id);
  assert.equal(await service.getPendingCount(bob.id), 1);
  assert.equal((await service.getPendingNotifications(bob.id))[0].followup.lead.id, own.id);
});

test('repair F02: stale rows cannot bypass current ownership, DND or deletion filters', async () => {
  const service = app.get(NotificationsService);
  const [followup] = await database.db.insert(followups).values({ leadId: other.id, userId: alice.id, status: 'Scheduled',
    nextCallDate: new Date(Date.now() + 300000), remarks: 'Foreign lead secret' }).returning();
  await database.db.insert(notifications).values({ userId: alice.id, followupId: followup.id, type: 'upcoming' });
  assert.deepEqual(await service.getNotifications(alice.id), []);
  assert.deepEqual(await service.getPendingNotifications(alice.id), []);
  assert.equal(await service.getPendingCount(alice.id), 0);
  await service.syncNotificationsForUser(alice.id);
  assert.equal((await database.db.select().from(notifications)).length, 0);
  await app.get(LeadsService).updateStatus(own.id, { status: 'Scheduled', nextCallDate: new Date(Date.now() + 300000).toISOString() }, alice.id, 'USER');
  await database.db.update(leads).set({ dnd: true }).where(eq(leads.id, own.id));
  assert.equal(await service.getPendingCount(alice.id), 0);
  await database.db.update(leads).set({ dnd: false, isDeleted: true }).where(eq(leads.id, own.id));
  assert.equal(await service.getPendingCount(alice.id), 0);
});

test('repair F02: round-robin reassignment clears the previous owners notifications', async () => {
  await app.get(LeadsService).updateStatus(own.id, { status: 'Scheduled', nextCallDate: new Date(Date.now() + 300000).toISOString() }, alice.id, 'USER');
  await app.get(RoundRobinService).allocateRoundRobin(campaign.id, [own.id]);
  assert.equal((await database.db.select().from(leads).where(eq(leads.id, own.id)))[0].doerId, bob.id);
  assert.equal((await database.db.select().from(notifications)).length, 0);
});

// Read the real ZIP central directory, decompress entries and validate CRCs without a test-only dependency.
function readZip(bytes: Buffer) {
  const end = bytes.lastIndexOf(Buffer.from('504b0506', 'hex')); assert.ok(end > 0, 'ZIP end record');
  const files: Record<string, string> = {}; let at = bytes.readUInt32LE(end + 16);
  for (let index = 0; index < bytes.readUInt16LE(end + 10); index++) {
    assert.equal(bytes.readUInt32LE(at), 0x02014b50);
    const method = bytes.readUInt16LE(at + 10), size = bytes.readUInt32LE(at + 20), length = bytes.readUInt16LE(at + 28);
    const name = bytes.toString('utf8', at + 46, at + 46 + length), local = bytes.readUInt32LE(at + 42);
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const data = method === 8 ? inflateRawSync(bytes.subarray(start, start + size)) : bytes.subarray(start, start + size);
    assert.equal(data.length, bytes.readUInt32LE(at + 24));
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    assert.equal((crc ^ 0xffffffff) >>> 0, bytes.readUInt32LE(at + 16), name + ' CRC');
    files[name] = data.toString('utf8'); at += 46 + length + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32);
  }
  return files;
}

test('repair F03: real HTTP export produces a valid multi-buffer ZIP with all six CSVs', { timeout: 15000 }, async () => {
  await database.db.insert(leads).values(Array.from({ length: 400 }, () => ({ campaignId: campaign.id, name: randomBytes(100).toString('hex'), doerId: alice.id })));
  const response = await request('/admin/data-export/download', adminToken);
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type')!, /application\/zip/);
  const bytes = Buffer.from(await response.arrayBuffer()); assert.ok(bytes.length > 16384);
  const files = readZip(bytes);
  assert.deepEqual(Object.keys(files).sort(), ['campaign_statuses.csv', 'campaigns.csv', 'followups.csv', 'form_responses.csv', 'forms.csv', 'leads.csv']);
  assert.equal(parse(files['leads.csv'], { columns: true }).length, 402);
});

test('repair F05/F20: date filters honor explicit bounds and reject invalid ranges before SQL', async () => {
  const response = await request('/dashboard/daily-trend?startDate=2026-10-01&endDate=2026-10-16');
  assert.equal(response.status, 200); const days = await response.json() as any[];
  assert.equal(days.length, 16); assert.equal(days[0].date, '2026-10-01'); assert.equal(days[15].date, '2026-10-16');
  for (const path of ['/dashboard/daily-trend?startDate=invalid-date', '/dashboard/daily-trend?startDate=2026-02-30',
    '/dashboard/daily-trend?startDate=2026-10-16&endDate=2026-10-01', '/dashboard/kpi?endDate=wrong',
    '/dashboard/campaign-report?startDate=wrong', '/dashboard/user-conversion?startDate=wrong']) {
    assert.equal((await request(path)).status, 400, path);
  }
});

test('repair F11/F12: followup filters/cursors validate and JSON string booleans are rejected', async () => {
  for (const path of [`/followups/my?campaignId=${campaign.id}`, `/followups/my?cursor=${new Date().toISOString()}`,
    `/followups/upcoming?campaignId=${campaign.id}`]) assert.equal((await request(path)).status, 200);
  const my = await (await request('/followups/my')).json() as any; assert.ok(Array.isArray(my.data)); assert.equal(my.cursor, null);
  assert.equal((await request('/followups/my?cursor=bad')).status, 400);
  assert.equal((await request(`/leads/${own.id}/status`, aliceToken, 'PUT', { status: 'Called', dnd: 'false' })).status, 400);
  assert.equal((await request(`/users/${bob.id}`, adminToken, 'PUT', { isActive: 'false' })).status, 400);
  assert.equal((await database.db.select().from(leads).where(eq(leads.id, own.id)))[0].dnd, false);
});

test('repair F08/F18: empty optional settings persist and USER branding excludes credentials', async () => {
  assert.equal((await request('/settings', adminToken, 'POST', { key: 'companyPhone', value: '' })).status, 201);
  assert.equal((await (await request('/settings/companyPhone', adminToken)).json() as any).value, '');
  await app.get(SettingsService).createSetting({ key: 'companyName', value: 'Fixture Company' });
  await app.get(SettingsService).createSetting({ key: 'gupshupApiKey', value: 'PrivateFixtureOnly' });
  const response = await request('/branding'); assert.equal(response.status, 200);
  const branding = await response.json() as any[];
  assert.deepEqual(branding.map(row => row.key), ['companyName']); assert.equal(branding[0].value, 'Fixture Company');
  assert.equal((await fetch(api + '/branding')).status, 401);
  assert.equal((await request('/settings')).status, 403);
});

test('repair F09/F16: supported inline files submit, and inactive/unpublished intake is rejected', async () => {
  const form = await makePublicForm(); const path = `/forms/public/${form.publicSlug}`;
  const bytes = Buffer.alloc(1200 * 1024, 65);
  const response = await fetch(api + path + '/submit', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: { name: 'Attachment fixture', attachment: { name: 'file.txt', size: bytes.length, type: 'text/plain', dataUrl: 'data:text/plain;base64,' + bytes.toString('base64') } } }) });
  assert.equal(response.status, 201);
  await database.db.update(campaigns).set({ isActive: false }).where(eq(campaigns.id, campaign.id));
  assert.equal((await fetch(api + path)).status, 404);
  assert.equal((await request(path + '/submit', adminToken, 'POST', { data: { name: 'Stopped' } })).status, 404);
  await database.db.update(campaigns).set({ isActive: true }).where(eq(campaigns.id, campaign.id));
  await database.db.update(forms).set({ isPublished: false }).where(eq(forms.id, form.id));
  assert.equal((await request(path + '/submit', adminToken, 'POST', { data: { name: 'Unpublished' } })).status, 404);
  assert.equal((await database.db.select().from(enquiries)).length, 1);
});

test('repair F17: deletion requires confirmation and excludes concurrent backup/restore operations', async () => {
  assert.equal((await request('/admin/data-export/all', adminToken, 'DELETE')).status, 400);
  assert.equal((await request('/admin/data-export/all', adminToken, 'DELETE', { confirmation: 'wrong' })).status, 400);
  assert.equal((await request('/admin/data-export/all', aliceToken, 'DELETE', { confirmation: 'DELETE ALL' })).status, 403);
  const lock = await database.getPool().connect();
  try {
    await lock.query('SELECT pg_advisory_lock(1465078355)');
    assert.equal((await request('/admin/data-export/all', adminToken, 'DELETE', { confirmation: 'DELETE ALL' })).status, 409);
  } finally { await lock.query('SELECT pg_advisory_unlock(1465078355)'); lock.release(); }
  assert.equal((await database.db.select().from(leads)).length, 2);
});

test('repair F17: confirmed deletion removes WhatsApp and IVR data but preserves users and settings', async () => {
  await database.db.insert(whatsappMessages).values({ phone: own.phone!, leadId: own.id, direction: 'in', message: 'Delete fixture' });
  await database.db.insert(whatsappContacts).values({ phone: own.phone!, leadId: own.id });
  await database.db.insert(ivrCalls).values({ tenantId: 'deletion-fixture', externalCallId: 'delete-call', providerCallId: 'delete-call',
    crmCampaignId: campaign.id, leadId: own.id, phone: own.phone!, status: 'ringing' });
  await database.db.insert(ivrWebhookEvents).values({ eventKey: 'delete-event', tenantId: 'deletion-fixture', externalCallId: 'delete-call',
    crmCampaignId: campaign.id, payload: { callernumber: own.phone }, status: 'pending' });
  await app.get(SettingsService).createSetting({ key: 'companyName', value: 'Keep fixture' });
  const response = await request('/admin/data-export/all', adminToken, 'DELETE', { confirmation: 'DELETE ALL' });
  assert.equal(response.status, 200); const result = await response.json() as any;
  assert.equal(result.deletedMessages, 1); assert.equal(result.deletedContacts, 1); assert.equal(result.deletedLeads, 2);
  assert.equal(result.deletedIvrCalls, 1); assert.equal(result.deletedIvrEvents, 1);
  assert.equal((await database.db.select().from(whatsappMessages)).length, 0);
  assert.equal((await database.db.select().from(whatsappContacts)).length, 0);
  assert.equal((await database.db.select().from(ivrCalls)).length, 0);
  assert.equal((await database.db.select().from(ivrWebhookEvents)).length, 0);
  assert.equal((await database.db.select().from(users)).length, 3);
  assert.equal((await app.get(SettingsService).getSetting('companyName')).value, 'Keep fixture');
});


const inboundReply = (phone: string, text = 'Customer reply') => ({ type: 'message', payload: {
  id: randomUUID(), sender: { phone, name: 'Customer' }, type: 'text', payload: { text },
} });
const postReply = (payload: unknown, token = webhookToken) => fetch(api + '/integrations/gupshup/webhook?token=' + encodeURIComponent(token), {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
});

test('incoming replies accept authenticated URL callbacks and prefer explicit header credentials', async () => {
  const reply = inboundReply(own.phone!);
  assert.equal((await postReply(reply)).status, 200);
  const [saved] = await database.db.select().from(whatsappMessages).where(eq(whatsappMessages.messageId, reply.payload.id));
  assert.equal(saved.leadId, own.id); assert.equal(saved.message, 'Customer reply');
  assert.equal((await fetch(api + '/whatsapp/webhook?token=' + webhookToken, { method: 'POST', headers: {
    'content-type': 'application/json', 'x-webhook-token': 'wrong',
  }, body: JSON.stringify(inboundReply(own.phone!)) })).status, 401);
  assert.equal((await fetch(api + '/whatsapp/webhook?token=' + webhookToken + '&token=other', { method: 'POST', headers: {
    'content-type': 'application/json',
  }, body: '{}' })).status, 401);
});

test('incoming replies link local/formatted Indian lead numbers and stay visible only to their owner', async () => {
  for (const formatted of ['9000000001', '09000000001', '+91 90000 00001']) {
    await database.db.update(leads).set({ phone: formatted }).where(eq(leads.id, own.id));
    const reply = inboundReply('+91 90000 00001', 'Reply for ' + formatted);
    assert.equal((await postReply(reply)).status, 200);
    const rows = await (await request('/whatsapp/chats')).json() as any[];
    assert.equal(rows.length, 1); assert.equal(rows[0].phone, '919000000001');
    const [saved] = await database.db.select().from(whatsappMessages).where(eq(whatsappMessages.messageId, reply.payload.id));
    assert.equal(saved.leadId, own.id);
  }
  const bobToken = (await app.get(AuthService).login({ username: 'bob', password: 'SecurityFixture123' })).access_token;
  assert.deepEqual(await (await request('/whatsapp/chats', bobToken)).json(), []);
  assert.equal((await database.db.select().from(followups)).length, 3);
});

test('concurrent provider retries produce one message and one CRM followup', async () => {
  const reply = inboundReply(own.phone!);
  const results = await Promise.all(Array.from({ length: 8 }, () => postReply(reply)));
  assert.ok(results.every(r => r.status === 200));
  assert.equal((await database.db.select().from(whatsappMessages)).length, 1);
  assert.equal((await database.db.select().from(followups)).length, 1);
  assert.equal((await database.db.select().from(whatsappContacts)).length, 1);
});

test('delivery events posted to the main Gupshup callback update status without creating inbound chats', async () => {
  const id = randomUUID();
  await database.db.insert(whatsappMessages).values({ phone: own.phone!, messageId: id, direction: 'out', message: 'Sent', status: 'submitted', leadId: own.id });
  assert.equal((await postReply({ type: 'message-event', payload: { id, type: 'delivered' } })).status, 200);
  const [saved] = await database.db.select().from(whatsappMessages);
  assert.equal(saved.status, 'delivered');
  assert.equal((await database.db.select().from(whatsappMessages)).length, 1);
  assert.equal((await database.db.select().from(followups)).length, 0);
});

test('admin callback setup generates a masked secret, rotates credentials, and exposes no secret on reload', async () => {
  const path = '/whatsapp/webhook-config';
  await database.db.delete(settingsTable).where(eq(settingsTable.key, 'gupshupWebhookToken'));
  try {
    assert.equal((await request(path)).status, 403);
    assert.equal((await request(path + '/token', aliceToken, 'POST')).status, 403);
    assert.equal((await fetch(api + path)).status, 401);
    const initial = await (await request(path, adminToken)).json() as any;
    assert.equal(initial.configured, true); // Environment fallback.
    const generated = await request(path + '/token', adminToken, 'POST');
    assert.equal(generated.status, 201);
    const { token } = await generated.json() as any;
    assert.equal(typeof token, 'string'); assert.equal(token.length, 64);
    assert.equal((await postReply(inboundReply(own.phone!), webhookToken)).status, 401);
    assert.equal((await postReply(inboundReply(own.phone!), token)).status, 200);
    const config = await (await request(path, adminToken)).json() as any;
    assert.equal(config.configured, true); assert.ok(config.lastReceivedAt); assert.ok(!JSON.stringify(config).includes(token));
    const all = await (await request('/settings', adminToken)).json() as any[];
    const saved = all.find(s => s.key === 'gupshupWebhookToken');
    assert.equal(saved.isMasked, true); assert.notEqual(saved.value, token);
    const rotated = await (await request(path + '/token', adminToken, 'POST')).json() as any;
    assert.equal((await postReply(inboundReply(own.phone!), token)).status, 401);
    assert.equal((await postReply(inboundReply(own.phone!), rotated.token)).status, 200);
  } finally { await database.db.delete(settingsTable).where(eq(settingsTable.key, 'gupshupWebhookToken')); }
});

test('database failure returns a retryable error and rolls back inbound contact/message/followup writes', async () => {
  await database.getPool().query(`CREATE FUNCTION reject_inbound_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Fixture storage failure'; END $$;
    CREATE TRIGGER reject_inbound_fixture BEFORE INSERT ON "WhatsappMessage" FOR EACH ROW EXECUTE FUNCTION reject_inbound_fixture()`);
  const reply = inboundReply(own.phone!);
  try {
    assert.equal((await postReply(reply)).status, 500);
    assert.equal((await database.db.select().from(whatsappContacts)).length, 0);
    assert.equal((await database.db.select().from(followups)).length, 0);
    assert.equal((await database.db.select().from(whatsappMessages)).length, 0);
  } finally { await database.getPool().query('DROP TRIGGER reject_inbound_fixture ON "WhatsappMessage"; DROP FUNCTION reject_inbound_fixture()'); }
  assert.equal((await postReply(reply)).status, 200);
  assert.equal((await database.db.select().from(whatsappMessages)).length, 1);
});

test('URL callback logging never exposes secrets or phone numbers on either webhook alias', () => {
  for (const path of ['/api/v1/whatsapp/webhook', '/api/v1/integrations/gupshup/webhook/status', '/API/V1/WHATSAPP/WEBHOOK/']) {
    const middleware = new StructuredLoggingMiddleware(); const logs: string[] = [];
    (middleware as any).logger = { log: (value: string) => logs.push(value) };
    const response = Object.assign(new EventEmitter(), { statusCode: 200, json: (body: any) => body });
    middleware.use({ method: 'POST', originalUrl: path + '?token=private-secret&phone=919000000001', headers: {}, socket: {} } as any, response as any, () => {});
    response.emit('finish');
    assert.equal(JSON.parse(logs[0]).url, path);
    assert.ok(!logs[0].includes('private-secret')); assert.ok(!logs[0].includes('919000000001'));
  }
});

test('legacy local-number history and new country-code replies remain in one owned conversation', async () => {
  await database.db.insert(whatsappMessages).values({ phone: '9000000001', leadId: own.id, direction: 'out', message: 'Old local history', status: 'sent' });
  const reply = inboundReply(own.phone!);
  assert.equal((await postReply(reply)).status, 200);
  const chats = await (await request('/whatsapp/chats')).json() as any[];
  assert.equal(chats.length, 1); assert.equal(chats[0].totalMessages, 2);
  const messages = await (await request('/whatsapp/chats/919000000001/messages')).json() as any[];
  assert.deepEqual(new Set(messages.map(m => m.message)), new Set(['Old local history', 'Customer reply']));
  const stats = await (await request('/whatsapp/stats')).json() as any;
  assert.equal(stats.uniqueChats, 1);
});

test('normalizing legacy unlinked history does not expose shared-number messages to another owner', async () => {
  await database.db.update(leads).set({ phone: '9000000001' }).where(eq(leads.id, other.id));
  await database.db.insert(whatsappMessages).values({ phone: '9000000001', direction: 'in', message: 'Ambiguous shared history', status: 'received' });
  assert.deepEqual(await (await request('/whatsapp/chats')).json(), []);
  assert.deepEqual(await (await request('/whatsapp/chats/919000000001/messages')).json(), []);
});

test('incoming Gupshup images retain their attachment URL and caption for the chat UI', async () => {
  const id = randomUUID();
  const payload = { type: 'message', payload: { id, source: own.phone, type: 'image', payload: { url: 'https://media.example.test/customer.jpg', caption: 'Customer photo' } } };
  assert.equal((await postReply(payload)).status, 200);
  const rows = await (await request(`/whatsapp/chats/${own.phone}/messages`)).json() as any[];
  assert.equal(rows.length, 1); assert.equal(rows[0].type, 'image');
  assert.equal(rows[0].mediaUrl, 'https://media.example.test/customer.jpg'); assert.equal(rows[0].message, 'Customer photo');
});

test('WhatsApp nested image and document fields retain captions and direct file links', async () => {
  for (const [type, media, expected] of [
    ['image', { url: 'https://media.example.test/image.png', caption: 'Image caption' }, 'Image caption'],
    ['document', { url: 'https://media.example.test/quotation.pdf', caption: 'Your quotation', filename: 'quotation.pdf' }, 'Your quotation'],
    ['document', { url: 'https://media.example.test/manual.pdf', filename: 'manual.pdf' }, 'manual.pdf'],
  ] as const) {
    const id = randomUUID();
    const payload = { entry: [{ changes: [{ value: { messages: [{ id, from: own.phone, type, [type]: media }] } }] }] };
    assert.equal((await postReply(payload)).status, 200);
    const [saved] = await database.db.select().from(whatsappMessages).where(eq(whatsappMessages.messageId, id));
    assert.equal(saved.mediaUrl, media.url); assert.equal(saved.message, expected);
  }
});

test('simple WhatsApp file and native audio callbacks preserve direct links', async () => {
  const id = randomUUID();
  assert.equal((await postReply({ user: { phone: own.phone }, message: { id, type: 'file', url: 'https://media.example.test/file.zip', caption: 'Project files' } })).status, 200);
  let [saved] = await database.db.select().from(whatsappMessages).where(eq(whatsappMessages.messageId, id));
  assert.equal(saved.mediaUrl, 'https://media.example.test/file.zip'); assert.equal(saved.message, 'Project files');
  const audioId = randomUUID();
  assert.equal((await postReply({ type: 'message', payload: { id: audioId, source: own.phone, type: 'audio', payload: { url: 'https://media.example.test/voice.ogg' } } })).status, 200);
  [saved] = await database.db.select().from(whatsappMessages).where(eq(whatsappMessages.messageId, audioId));
  assert.equal(saved.mediaUrl, 'https://media.example.test/voice.ogg');
});

test('replaying a previously saved image recovers the missing URL without duplicating messages or followups', async () => {
  const id = randomUUID();
  await database.db.insert(whatsappMessages).values({ phone: own.phone!, direction: 'in', leadId: own.id, messageId: id, type: 'image', message: '[Image]' });
  const payload = { type: 'message', payload: { id, source: own.phone, type: 'image', payload: { url: 'https://media.example.test/recovered.jpg', caption: 'Recovered caption' } } };
  assert.equal((await postReply(payload)).status, 200);
  assert.equal((await postReply(payload)).status, 200);
  const rows = await database.db.select().from(whatsappMessages);
  assert.equal(rows.length, 1); assert.equal(rows[0].mediaUrl, 'https://media.example.test/recovered.jpg'); assert.equal(rows[0].message, 'Recovered caption');
  assert.equal((await database.db.select().from(followups)).length, 0);
});

test('non-web attachment URLs are not exposed as clickable links', async () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd']) {
    const id = randomUUID();
    assert.equal((await postReply({ type: 'message', payload: { id, source: own.phone, type: 'document', payload: { url, caption: 'File' } } })).status, 200);
    const [saved] = await database.db.select().from(whatsappMessages).where(eq(whatsappMessages.messageId, id));
    assert.equal(saved.mediaUrl, null); assert.equal(saved.message, 'File');
  }
});
