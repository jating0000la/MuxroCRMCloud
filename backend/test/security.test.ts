import 'reflect-metadata';
import { before, beforeEach, after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { spawn } from 'node:child_process';
import * as bcrypt from 'bcryptjs';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { DatabaseService } from '../src/db/database.service';
import { AuthService } from '../src/auth/auth.service';
import { FormsService } from '../src/forms/forms.service';
import { LeadsService } from '../src/leads/leads.service';
import { RoundRobinService } from '../src/common/services/round-robin.service';
import { BulkImportService } from '../src/bulk-import/bulk-import.service';
import { DataExportService } from '../src/data-export/data-export.service';
import { parse } from 'csv-parse/sync';
import { eq } from 'drizzle-orm';
import { users, campaigns, campaignUsers, campaignStatuses, leads, followups, forms, enquiries, whatsappMessages, whatsappContacts, roundRobinCursors } from '../src/db/schema';

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
    for (const file of ['0000_acoustic_tarot.sql', '0001_whatsapp_tables.sql', '0002_performance_indexes.sql', '0003_round_robin_cursor.sql']) {
      await init.query(readFileSync(join(__dirname, '../drizzle', file), 'utf8'));
    }
  } finally { await init.end(); }
  process.chdir(directory); // Keep uploads out of the checkout.
  const { AppModule } = require('../src/app.module');
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });
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
