import 'reflect-metadata';
import { before, beforeEach, after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { DatabaseService } from '../src/db/database.service';
import { AuthService } from '../src/auth/auth.service';
import { configureBodyLimits } from '../src/common/http-body-limits';
import { StructuredLoggingMiddleware } from '../src/common/logging/structured-logging.middleware';
import { CloudConnectService } from '../src/integrations/cloudconnect/cloudconnect.service';
import { users, campaigns, campaignUsers, campaignStatuses, leads, ivrCalls, ivrWebhookEvents } from '../src/db/schema';

// Never write fixtures into the configured development database or checkout.
const base = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const databaseName = `muxro_ivr_test_${randomUUID().replace(/-/g, '')}`;
const directory = mkdtempSync(join(tmpdir(), 'muxro-ivr-'));
const originalCwd = process.cwd();
let root: Pool, app: INestApplication, database: DatabaseService, integration: CloudConnectService;
let api: string, passwordHash: string, adminToken: string, aliceToken: string, bobToken: string, webhookToken: string;
let created = false;
let admin: typeof users.$inferSelect, alice: typeof users.$inferSelect, bob: typeof users.$inferSelect;
let campaign: typeof campaigns.$inferSelect, privateCampaign: typeof campaigns.$inferSelect;
let initialStatus: typeof campaignStatuses.$inferSelect;

before(async () => {
  assert.ok(base, 'Use a development PostgreSQL URL with CREATE DATABASE permission');
  root = new Pool({ connectionString: base });
  await root.query(`CREATE DATABASE "${databaseName}"`); created = true;
  const url = new URL(base); url.pathname = `/${databaseName}`;
  process.env.DATABASE_URL = url.toString();
  process.env.BACKUP_DIR = join(directory, 'backups');
  process.env.CRM_PROCESS_ROLE = 'api';
  process.env.NODE_ENV = 'development';
  for (const key of ['JWT_SECRET', 'APP_ENCRYPTION_KEY', 'ENCRYPTION_SALT']) process.env[key] = randomBytes(32).toString('hex');
  const init = new Pool({ connectionString: url.toString() });
  try {
    const migrationDirectory = join(__dirname, '../drizzle');
    for (const file of readdirSync(migrationDirectory).filter(file => /^\d+.*\.sql$/.test(file)).sort()) {
      await init.query(readFileSync(join(migrationDirectory, file), 'utf8'));
    }
  } finally { await init.end(); }
  process.chdir(directory);
  const { AppModule } = require('../src/app.module');
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });
  configureBodyLimits(app);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
  await app.listen(0, '127.0.0.1');
  api = `${await app.getUrl()}/api/v1`;
  database = app.get(DatabaseService); integration = app.get(CloudConnectService);
  passwordHash = await bcrypt.hash('IvrFixturePass123', 4);
});

beforeEach(async () => {
  await integration.drainInbox();
  await database.getPool().query('TRUNCATE "User", "Campaign", "Lead", "Setting" CASCADE');
  // Inbox rows need not reference a lead until they have been processed.
  await database.db.delete(ivrWebhookEvents);
  await database.db.delete(ivrCalls);
  [admin, alice, bob] = await database.db.insert(users).values([
    { username: 'admin', name: 'Administrator', role: 'ADMIN', password: passwordHash },
    { username: 'alice', name: 'Alice Sales', role: 'USER', password: passwordHash },
    { username: 'bob', name: 'Bob Sales', role: 'USER', password: passwordHash },
  ]).returning();
  [campaign, privateCampaign] = await database.db.insert(campaigns).values([
    { name: 'IVR Enquiries', managerId: admin.id }, { name: 'Other campaign', managerId: admin.id },
  ]).returning();
  await database.db.insert(campaignUsers).values([
    { campaignId: campaign.id, userId: alice.id, assignedAt: new Date('2020-01-01') },
    { campaignId: campaign.id, userId: bob.id, assignedAt: new Date('2020-01-02') },
  ]);
  [initialStatus] = await database.db.insert(campaignStatuses).values({ campaignId: campaign.id, label: 'New', order: 0 }).returning();
  const auth = app.get(AuthService);
  adminToken = (await auth.login({ username: 'admin', password: 'IvrFixturePass123' })).access_token;
  aliceToken = (await auth.login({ username: 'alice', password: 'IvrFixturePass123' })).access_token;
  bobToken = (await auth.login({ username: 'bob', password: 'IvrFixturePass123' })).access_token;
  const tokenResponse = await request('/integrations/cloudconnect/webhook-token', adminToken, 'POST');
  assert.equal(tokenResponse.status, 201);
  webhookToken = (await tokenResponse.json() as any).token;
  assert.ok(webhookToken && webhookToken.length >= 32);
  await configure();
});

after(async () => {
  if (app) await app.close();
  process.chdir(originalCwd);
  if (created) await root.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  if (root) await root.end();
  rmSync(directory, { recursive: true, force: true });
});

function request(path: string, token = adminToken, method = 'GET', body?: unknown) {
  return fetch(api + path, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
}
function config(overrides: Record<string, unknown> = {}) {
  return { enabled: true, tenantId: '10001', crmCampaignId: campaign.id, inboundCampaignIds: ['1001'], operators: [{ agentId: '77', name: 'Reception Operator' }], ...overrides };
}
async function configure(overrides: Record<string, unknown> = {}) {
  const response = await request('/integrations/cloudconnect/config', adminToken, 'PUT', config(overrides));
  assert.equal(response.status, 200, await response.text());
}
function event(overrides: Record<string, unknown> = {}) {
  return { call_uuid: randomUUID(), callid: `call-${randomUUID()}`, callernumber: '919123456789', status: 'Ringing', campaignId: '1001', call_direction: 'INBOUND', agent_id: '77', ...overrides };
}
async function receive(payload: Record<string, unknown>) {
  await integration.receive(payload, webhookToken);
  await integration.drainInbox();
}
const getLeads = () => database.db.select().from(leads);
const getCalls = () => database.db.select().from(ivrCalls);

test('CloudConnect configuration, token rotation and inbox administration require an administrator', async () => {
  for (const token of [aliceToken, bobToken]) {
    assert.equal((await request('/integrations/cloudconnect/config', token)).status, 403);
    assert.equal((await request('/integrations/cloudconnect/config', token, 'PUT', config())).status, 403);
    assert.equal((await request('/integrations/cloudconnect/webhook-token', token, 'POST')).status, 403);
    assert.equal((await request('/integrations/cloudconnect/events', token)).status, 403);
  }
  assert.equal((await fetch(api + '/integrations/cloudconnect/config')).status, 401);
  const visible = await (await request('/integrations/cloudconnect/config')).json() as any;
  assert.equal(visible.enabled, true); assert.equal(visible.crmCampaignId, campaign.id);
  assert.equal(visible.webhookTokenConfigured, true);
  assert.equal(JSON.stringify(visible).includes(webhookToken), false);
});

test('CloudConnect cannot be enabled for inactive campaigns or campaigns without active sales members', async () => {
  await database.db.update(campaigns).set({ isActive: false }).where(eq(campaigns.id, campaign.id));
  assert.equal((await request('/integrations/cloudconnect/config', adminToken, 'PUT', config())).status, 400);
  await configure({ enabled: false });
  await database.db.update(campaigns).set({ isActive: true }).where(eq(campaigns.id, campaign.id));
  await database.db.update(campaignUsers).set({ isActive: false });
  assert.equal((await request('/integrations/cloudconnect/config', adminToken, 'PUT', config())).status, 400);
  await database.db.update(campaignUsers).set({ isActive: true });
  await database.db.update(users).set({ isActive: false }).where(eq(users.role, 'USER'));
  assert.equal((await request('/integrations/cloudconnect/config', adminToken, 'PUT', config())).status, 400);
  await database.db.delete(campaigns).where(eq(campaigns.id, campaign.id));
  await configure({ enabled: false });
});

test('CloudConnect webhook requires the integration token and fails closed when disabled', async () => {
  const payload = event();
  for (const token of ['', 'wrong', `${webhookToken}x`]) {
    const response = await fetch(api + '/integrations/cloudconnect/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-cloudconnect-token': token }, body: JSON.stringify(payload) });
    assert.equal(response.status, 401);
  }
  await configure({ enabled: false });
  assert.equal((await fetch(api + '/integrations/cloudconnect/webhook?token=' + webhookToken, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })).status, 503);
  assert.equal((await getLeads()).length, 0); assert.equal((await getCalls()).length, 0);
});

test('CloudConnect accepts provider GET, JSON POST and URL-encoded POST without requiring CRM login', async () => {
  const payloads = [event({ callernumber: '+91 91234 56789' }), event({ callernumber: '919123456780' }), event({ callernumber: '919123456781' })];
  const responses = [
    await fetch(api + '/integrations/cloudconnect/webhook?' + new URLSearchParams({ ...payloads[0] as Record<string, string>, token: webhookToken })),
    await fetch(api + '/integrations/cloudconnect/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-cloudconnect-token': webhookToken }, body: JSON.stringify(payloads[1]) }),
    await fetch(api + '/integrations/cloudconnect/webhook?token=' + webhookToken, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(payloads[2] as Record<string, string>) }),
  ];
  for (const response of responses) { assert.equal(response.status, 202, await response.text()); }
  await integration.drainInbox();
  const rows = await getLeads();
  assert.equal(rows.length, 3);
  assert.ok(rows.every(row => row.source === 'ivr' && row.campaignId === campaign.id));
  assert.ok(rows.some(row => row.phone === '919123456789'));
  assert.deepEqual(new Set(rows.map(row => row.doerId)), new Set([alice.id, bob.id]));
});

test('one incoming call creates one enquiry through duplicate, transferred and out-of-order lifecycle events', async () => {
  const initial = event();
  await receive(initial);
  let [lead] = await getLeads();
  const owner = lead.doerId;
  assert.equal(lead.statusId, initialStatus.id);
  assert.ok(owner === alice.id || owner === bob.id);
  await receive({ ...initial, status: 'Answered', agent_id: '77' });
  await receive({ ...initial, status: 'Answered', agent_id: '88', transfer_id: 'transfer-2' });
  await receive({ ...initial, status: 'Hangup', agent_id: '88', reason: 'NORMAL_CLEARING' });
  await receive(initial); // A delayed Ringing event must not reopen an ended call.
  await receive({ ...initial, status: 'Hangup', agent_id: '88', reason: 'NORMAL_CLEARING' });
  const calls = await getCalls();
  assert.equal(calls.length, 1); assert.equal(calls[0].status, 'ended');
  assert.equal(calls[0].answered, true); assert.equal(calls[0].callbackNeeded, false);
  assert.equal(calls[0].externalCallId, initial.call_uuid); assert.equal(calls[0].leadId, lead.id);
  const rows = await getLeads();
  assert.equal(rows.length, 1); [lead] = rows;
  assert.equal(lead.doerId, owner, 'Receiving or transferring an IVR call must not reassign the salesperson');
});

test('IVR records the receiving operator independently of the assigned salesperson', async () => {
  await receive(event({ status: 'Answered' }));
  const [call] = await getCalls();
  assert.equal(call.agentId, '77'); assert.equal(call.operatorName, 'Reception Operator');
  const [lead] = await getLeads();
  assert.ok([alice.id, bob.id].includes(lead.doerId!));
  assert.notEqual(lead.doerId, admin.id);
});

test('repeat callers reuse their active campaign enquiry while preserving its owner, DND and status', async () => {
  const [old] = await database.db.insert(leads).values({ campaignId: campaign.id, name: 'Known customer', phone: '+91 91234 56789', source: 'manual', doerId: bob.id, dnd: true, statusId: initialStatus.id }).returning();
  await receive(event());
  await receive(event({ status: 'Hangup' }));
  const rows = await getLeads();
  assert.equal(rows.length, 1); assert.equal(rows[0].id, old.id);
  assert.equal(rows[0].name, 'Known customer'); assert.equal(rows[0].doerId, bob.id);
  assert.equal(rows[0].dnd, true); assert.equal(rows[0].statusId, initialStatus.id);
  assert.equal(rows[0].source, 'manual');
  assert.ok((await getCalls()).every(row => row.leadId === old.id));
});

test('phone matching does not reuse another campaign or a soft-deleted enquiry', async () => {
  await database.db.insert(leads).values([
    { campaignId: privateCampaign.id, name: 'Foreign campaign', phone: '919123456789', doerId: bob.id },
    { campaignId: campaign.id, name: 'Deleted enquiry', phone: '919123456789', doerId: bob.id, isDeleted: true },
  ]);
  await receive(event());
  const rows = await getLeads();
  assert.equal(rows.length, 3);
  const active = rows.find(row => row.campaignId === campaign.id && !row.isDeleted)!;
  assert.equal(active.source, 'ivr'); assert.equal((await getCalls())[0].leadId, active.id);
});

test('parallel calls and duplicate callbacks cannot create duplicate enquiries for the same phone', async () => {
  const same = event();
  await Promise.all(Array.from({ length: 6 }, () => integration.receive(same, webhookToken)));
  await integration.drainInbox();
  assert.equal((await getLeads()).length, 1); assert.equal((await getCalls()).length, 1);
  await Promise.all(Array.from({ length: 6 }, () => integration.receive(event(), webhookToken)));
  await integration.drainInbox();
  assert.equal((await getLeads()).length, 1); assert.equal((await getCalls()).length, 7);
});

test('outbound and unmapped CloudConnect calls never create IVR enquiries', async () => {
  for (const payload of [event({ call_direction: 'OUTBOUND' }), event({ campaignId: 'unmapped' })]) {
    const response = await fetch(api + '/integrations/cloudconnect/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-cloudconnect-token': webhookToken }, body: JSON.stringify(payload) });
    assert.equal(response.status, 202); assert.deepEqual(await response.json(), { accepted: true, ignored: true });
  }
  await integration.drainInbox();
  assert.equal((await getLeads()).length, 0); assert.equal((await getCalls()).length, 0);
});

test('malformed caller, status, direction and call identity are rejected without creating enquiries', async () => {
  for (const overrides of [
    { callernumber: 'not a phone' }, { callernumber: '123' }, { callernumber: '9'.repeat(40) },
    { status: 'invented' }, { status: 'constructor' }, { status: 'toString' }, { status: '__proto__' }, { call_direction: 'unknown' }, { call_uuid: '', callid: '' },
    { callernumber: { phone: '919123456789' } },
  ]) {
    const response = await fetch(api + '/integrations/cloudconnect/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-cloudconnect-token': webhookToken }, body: JSON.stringify(event(overrides)) });
    assert.equal(response.status, 400, JSON.stringify(overrides));
  }
  await integration.drainInbox(); assert.equal((await getLeads()).length, 0);
});

test('a Hangup-only call is retained for callback and a delayed Answered event cannot reset ended status', async () => {
  const payload = event({ status: 'Hangup', reason: 'NO_ANSWER', call_uuid: '', callid: 'fallback-call-id' });
  await receive(payload);
  let [call] = await getCalls();
  assert.equal(call.externalCallId, 'fallback-call-id'); assert.equal(call.status, 'ended');
  assert.equal(call.answered, false); assert.equal(call.callbackNeeded, true);
  await receive({ ...payload, status: 'Answered' });
  [call] = await getCalls();
  assert.equal(call.status, 'ended'); assert.equal(call.answered, true); assert.equal(call.callbackNeeded, false);
});

test('tenant changes isolate identical provider call IDs without duplicating a known campaign enquiry', async () => {
  const payload = event();
  await receive(payload);
  await configure({ tenantId: '10002' });
  await receive(payload);
  const calls = await getCalls();
  assert.equal(calls.length, 2); assert.equal(new Set(calls.map(row => row.tenantId)).size, 2);
  assert.equal((await getLeads()).length, 1);
});

test('unassignable incoming events remain retryable and become enquiries when a sales member is restored', async () => {
  await database.db.update(campaignUsers).set({ isActive: false });
  const payload = event();
  await receive(payload);
  assert.equal((await getLeads()).length, 0);
  const inbox = await database.db.select().from(ivrWebhookEvents);
  assert.equal(inbox.length, 1);
  assert.notEqual(inbox[0].status, 'processed');
  await database.db.update(campaignUsers).set({ isActive: true }).where(eq(campaignUsers.userId, alice.id));
  assert.equal((await request(`/integrations/cloudconnect/events/${inbox[0].id}/retry`, adminToken, 'POST')).status, 202);
  await integration.drainInbox();
  assert.equal((await getLeads()).length, 1); assert.equal((await getLeads())[0].doerId, alice.id);
  assert.equal((await database.db.select().from(ivrWebhookEvents))[0].status, 'processed');
});

test('call history enforces lead ownership, limits and administrator-only global access', async () => {
  await receive(event({ status: 'Answered' }));
  const [lead] = await getLeads();
  const ownerToken = lead.doerId === alice.id ? aliceToken : bobToken;
  const otherToken = lead.doerId === alice.id ? bobToken : aliceToken;
  assert.equal((await request(`/integrations/cloudconnect/calls?leadId=${lead.id}`, ownerToken)).status, 200);
  assert.equal((await request(`/integrations/cloudconnect/calls?leadId=${lead.id}`, otherToken)).status, 403);
  assert.equal((await request('/integrations/cloudconnect/calls', otherToken)).status, 403);
  assert.equal((await request('/integrations/cloudconnect/calls', adminToken)).status, 200);
  for (const query of ['limit=1000000', 'page=-1', 'leadId=not-a-uuid']) {
    assert.equal((await request('/integrations/cloudconnect/calls?' + query)).status, 400, query);
  }
});

test('rotating the webhook token revokes the previous token and secrets stay masked in general settings', async () => {
  const rotated = await request('/integrations/cloudconnect/webhook-token', adminToken, 'POST');
  assert.equal(rotated.status, 201);
  const token = (await rotated.json() as any).token;
  assert.notEqual(token, webhookToken);
  await assert.rejects(() => integration.receive(event(), webhookToken));
  const allSettings = await (await request('/settings')).json();
  assert.equal(JSON.stringify(allSettings).includes(token), false);
  assert.equal(JSON.stringify(allSettings).includes(webhookToken), false);
  await integration.receive(event({ sessionId: 'provider-session', transfer_id: 'provider-transfer', job_id: 'provider-job', provider_extra: 'compatible' }), token);
  await integration.drainInbox();
  assert.equal((await getLeads()).length, 1);
});


test('CloudConnect saves and reloads a realistic operator directory larger than the old settings limit', async () => {
  const operators = Array.from({ length: 40 }, (_, index) => ({ agentId: String(100 + index), name: `Reception operator ${index + 1} for inbound customer enquiries` }));
  assert.ok(JSON.stringify(config({ operators })).length > 2000);
  await configure({ operators });
  const stored = await (await request('/integrations/cloudconnect/config')).json() as any;
  assert.deepEqual(stored.operators, operators);
  await receive(event({ agent_id: '139', status: 'Answered' }));
  assert.equal((await getCalls())[0].operatorName, operators[39].name);
});

test('the durable inbox stores normalized call metadata without webhook credentials or arbitrary provider fields', async () => {
  await integration.receive(event({ token: webhookToken, provider_extra: 'do-not-store-this', sessionId: 'private-provider-session' }), webhookToken);
  await integration.drainInbox();
  const [inbox] = await database.db.select().from(ivrWebhookEvents);
  const serialized = JSON.stringify(inbox.payload);
  assert.equal(serialized.includes(webhookToken), false);
  assert.equal(serialized.includes('do-not-store-this'), false);
  assert.equal(serialized.includes('private-provider-session'), false);
  assert.equal((inbox.payload as any).phone, '919123456789');
  assert.equal((inbox.payload as any).status, 'ringing');
});

test('HTTP request logs redact CloudConnect callback queries across methods, case and trailing slashes', () => {
  for (const [method, path, status] of [
    ['GET', '/api/v1/integrations/cloudconnect/webhook', 202],
    ['POST', '/api/v1/integrations/cloudconnect/webhook/', 401],
    ['GET', '/API/V1/INTEGRATIONS/CLOUDCONNECT/WEBHOOK/', 503],
  ] as const) {
    const middleware = new StructuredLoggingMiddleware();
    const entries: string[] = [];
    (middleware as any).logger = { log: (value: string) => entries.push(value), warn: (value: string) => entries.push(value), error: (value: string) => entries.push(value) };
    const req = { method, originalUrl: `${path}?token=${webhookToken}&callernumber=919123456789&agent_id=77`, headers: { 'user-agent': 'test' }, ip: '127.0.0.1', socket: {} };
    const res = Object.assign(new EventEmitter(), { statusCode: status, json(body: unknown) { return body; } });
    let passed = false;
    middleware.use(req as any, res as any, () => { passed = true; });
    res.json({ accepted: true }); res.emit('finish');
    assert.equal(passed, true); assert.equal(entries.length, 1);
    const entry = JSON.parse(entries[0]);
    assert.equal(entry.url, path); assert.equal(entry.method, method); assert.equal(entry.status, status);
    assert.equal(entries[0].includes(webhookToken), false);
    assert.equal(entries[0].includes('919123456789'), false);
  }
});

test('a real worker recovers a durable incoming enquiry without another webhook or API drain', { timeout: 25000 }, async () => {
  await database.db.update(campaignUsers).set({ isActive: false });
  await receive(event());
  const [pending] = await database.db.select().from(ivrWebhookEvents);
  assert.equal(pending.status, 'pending'); assert.ok(pending.attempts >= 1);
  assert.equal((await getLeads()).length, 0);
  await database.db.update(campaignUsers).set({ isActive: true }).where(eq(campaignUsers.userId, alice.id));
  await database.db.update(ivrWebhookEvents).set({ nextAttemptAt: new Date(0) }).where(eq(ivrWebhookEvents.id, pending.id));
  const child = spawn(process.execPath, ['--require', require.resolve('ts-node/register'), join(__dirname, '../src/worker.ts')], {
    cwd: directory,
    env: { ...process.env, TS_NODE_PROJECT: join(__dirname, '../tsconfig.json'), TS_NODE_TRANSPILE_ONLY: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output = (output + String(chunk)).slice(-6000); });
  child.stderr.on('data', chunk => { output = (output + String(chunk)).slice(-6000); });
  let exit: { code: number | null; signal: NodeJS.Signals | null } | undefined;
  const ended = new Promise<void>(resolve => child.once('exit', (code, signal) => { exit = { code, signal }; resolve(); }));
  try {
    const deadline = Date.now() + 15000;
    while ((await database.db.select().from(ivrWebhookEvents).where(eq(ivrWebhookEvents.id, pending.id)))[0].status !== 'processed') {
      assert.equal(exit, undefined, `Worker exited before recovery: ${output}`);
      assert.ok(Date.now() < deadline, `Worker did not recover the durable event: ${output}`);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    const [lead] = await getLeads();
    assert.equal(lead.doerId, alice.id); assert.equal(lead.source, 'ivr'); assert.equal((await getCalls()).length, 1);
    assert.match(output, /Registered 10\/10 job processors/);
  } finally {
    if (!exit) child.kill('SIGTERM');
    const killed = setTimeout(() => { if (!exit) child.kill('SIGKILL'); }, 7000);
    await ended; clearTimeout(killed);
  }
});

test('reusing a provider call identity for a different caller fails durably without altering the original enquiry', async () => {
  const initial = event();
  await receive(initial);
  const [originalLead] = await getLeads();
  await receive({ ...initial, callernumber: '919876543210', status: 'Answered' });
  const calls = await getCalls(); const rows = await getLeads();
  assert.equal(calls.length, 1); assert.equal(rows.length, 1);
  assert.equal(calls[0].leadId, originalLead.id); assert.equal(calls[0].phone, initial.callernumber);
  assert.equal(rows[0].phone, initial.callernumber);
  const events = await database.db.select().from(ivrWebhookEvents);
  assert.equal(events.length, 2);
  assert.ok(events.some(row => row.status !== 'processed' && row.attempts >= 1 && row.error));
});
