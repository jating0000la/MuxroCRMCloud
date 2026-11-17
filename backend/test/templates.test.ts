import 'reflect-metadata';
import { before, beforeEach, after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import { of, throwError } from 'rxjs';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../src/db/database.service';
import { SettingsService } from '../src/settings/settings.service';
import { AuthService } from '../src/auth/auth.service';
import { GupshupService } from '../src/integrations/gupshup.service';
import { GupshupTemplatesService } from '../src/integrations/templates/gupshup-templates.service';
import { normalizeTemplate } from '../src/integrations/templates/template.types';
import { OutboxService } from '../src/common/outbox/outbox.service';
import { JobService } from '../src/jobs/job.service';
import { JobExecutionService } from '../src/jobs/job-execution.service';
import { TemplateDeliveryService } from '../src/integrations/templates/template-delivery.service';
import { JOB_TYPES } from '../src/jobs/job.types';
import { users, campaigns, campaignUsers, campaignStatuses, forms, leads, outboxEvents, whatsappMessages, gupshupTemplates, jobLogs } from '../src/db/schema';

const base = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const databaseName = 'muxro_template_test_' + randomUUID().replaceAll('-', '');
const directory = mkdtempSync(join(tmpdir(), 'muxro-templates-'));
const originalCwd = process.cwd();
let root: Pool, app: INestApplication, database: DatabaseService, catalog: GupshupTemplatesService, provider: GupshupService;
let api: string, adminToken: string, userToken: string, hash: string, created = false;
let admin: typeof users.$inferSelect, salesperson: typeof users.$inferSelect, campaign: typeof campaigns.$inferSelect, status: typeof campaignStatuses.$inferSelect;
let posts: { url: string; form: URLSearchParams; headers: Record<string, string> }[] = [];
let templateRows: any[];
const response = (data: unknown) => of({ data, status: 200, headers: {}, config: {} } as any);
const media = 'https://files.example.test/header.jpg';
const templateConfig = (id = 'tpl-image') => ({ templateId: id, params: ['{{name}}', '{{order_number}}'], mediaUrl: media, recipientField: 'mobile' });
const providerTemplates = () => [
  { id: 'tpl-image', elementName: 'lead_welcome', languageCode: 'en_US', status: 'APPROVED', category: 'MARKETING', templateType: 'IMAGE', data: 'Hello {{1}}, enquiry {{2}}', parameterFormat: 'POSITIONAL', containerMeta: JSON.stringify({ mediaUrl: media, mediaId: 'provider-media', buttons: [{ type: 'URL', text: 'Visit website', url: 'https://example.test' }, { type: 'QUICK_REPLY', text: 'Contact me' }] }) },
  ...['text', 'document', 'video'].map(type => ({ id: 'tpl-' + type, elementName: 'welcome_' + type, status: 'APPROVED', languageCode: 'en', templateType: type.toUpperCase(), data: 'Hello {{1}}, enquiry {{2}}', containerMeta: JSON.stringify({ mediaUrl: 'https://files.example.test/header.' + (type === 'document' ? 'pdf' : 'mp4') }) })),
  { id: 'tpl-rejected', status: 'REJECTED', templateType: 'TEXT', data: 'Rejected' },
  { id: 'tpl-dynamic', status: 'APPROVED', templateType: 'TEXT', data: 'Hello', containerMeta: JSON.stringify({ buttons: [{ type: 'URL', text: 'Track', url: 'https://example.test/{{1}}' }] }) },
];

before(async () => {
  assert.ok(base); root = new Pool({ connectionString: base });
  await root.query(`CREATE DATABASE "${databaseName}"`); created = true;
  const url = new URL(base); url.pathname = '/' + databaseName; process.env.DATABASE_URL = url.toString();
  process.env.BACKUP_DIR = join(directory, 'backups'); process.env.NODE_ENV = 'development'; delete process.env.CRM_PROCESS_ROLE;
  for (const key of ['JWT_SECRET', 'APP_ENCRYPTION_KEY', 'ENCRYPTION_SALT']) process.env[key] = randomBytes(32).toString('hex');
  const init = new Pool({ connectionString: url.toString() });
  try { for (const name of readdirSync(join(__dirname, '../drizzle')).filter(n => /^\d+.*\.sql$/.test(n)).sort()) await init.query(readFileSync(join(__dirname, '../drizzle', name), 'utf8')); }
  finally { await init.end(); }
  process.chdir(directory);
  await startApi(false); hash = await bcrypt.hash('TemplatesFixture123', 4);
});
beforeEach(async () => {
  await app.get(OutboxService).publishFormGreetings();
  await database.getPool().query('TRUNCATE "User", "Campaign", "Setting", "GupshupTemplate", "OutboxEvent", "JobLog", "WhatsappMessage", "WhatsappContact" CASCADE');
  await database.getPool().query('TRUNCATE pgboss.job CASCADE');
  [admin, salesperson] = await database.db.insert(users).values([{ username: 'admin', name: 'Admin', password: hash, role: 'ADMIN' }, { username: 'sales', name: 'Sales', password: hash, role: 'USER' }]).returning();
  [campaign] = await database.db.insert(campaigns).values({ name: 'Template enquiries', managerId: admin.id }).returning();
  await database.db.insert(campaignUsers).values({ campaignId: campaign.id, userId: salesperson.id });
  [status] = await database.db.insert(campaignStatuses).values({ campaignId: campaign.id, label: 'New' }).returning();
  for (const [key, value] of Object.entries({ gupshupApiKey: 'fixture-only-api-key', gupshupSource: '919111111111', gupshupAppName: 'FixtureApp', gupshupAppId: 'fixture-app' })) await app.get(SettingsService).createSetting({ key, value }, admin.id);
  adminToken = (await app.get(AuthService).login({ username: 'admin', password: 'TemplatesFixture123' })).access_token;
  userToken = (await app.get(AuthService).login({ username: 'sales', password: 'TemplatesFixture123' })).access_token;
  templateRows = providerTemplates(); posts = [];
  (provider as any).http.get = () => response({ templates: templateRows });
  (provider as any).http.post = (url: string, body: string, opts: any) => { posts.push({ url, form: new URLSearchParams(body), headers: opts.headers }); return response({ status: 'submitted', messageId: 'gs-' + randomUUID() }); };
  await catalog.sync();
});
after(async () => {
  if (app) await app.close(); process.chdir(originalCwd);
  if (created) await root.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`); if (root) await root.end(); rmSync(directory, { recursive: true, force: true });
});
async function startApi(consumeTemplates: boolean) {
  const { AppModule } = require('../src/app.module');
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  // Isolate catalog/transaction tests from background polling. The API lifecycle
  // and real queue consumption are exercised below in a fresh, unmodified API.
  if (!consumeTemplates) app.get(TemplateDeliveryService).onApplicationBootstrap = async () => {};
  provider = app.get(GupshupService);
  (provider as any).http.get = () => response({ templates: templateRows });
  (provider as any).http.post = (url: string, body: string, opts: any) => { posts.push({ url, form: new URLSearchParams(body), headers: opts.headers }); return response({ status: 'submitted', messageId: 'gs-' + randomUUID() }); };
  app.setGlobalPrefix('api'); app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
  await app.listen(0, '127.0.0.1'); api = (await app.getUrl()) + '/api/v1';
  database = app.get(DatabaseService); catalog = app.get(GupshupTemplatesService);
}
async function waitForMessages(count: number) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline && (await database.db.select().from(whatsappMessages)).length < count) await new Promise(resolve => setTimeout(resolve, 100));
  const rows = await database.db.select().from(whatsappMessages);
  assert.equal(rows.length, count); return rows;
}

function request(path: string, method = 'GET', body?: unknown, token = adminToken) { return fetch(api + path, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) }); }
function fields(config: any = templateConfig()) { return [
  { name: 'name', label: 'Name', type: 'text', required: true }, { name: 'mobile', label: 'Mobile', type: 'text', required: true },
  { name: 'order_number', label: 'Order number', type: 'text', required: true },
  { name: '__form_meta', label: 'Form Meta', type: '__design_meta', meta: { communication: { whatsappEnabled: true, ...config } } },
]; }
async function makeForm(config?: any) {
  const created = await request(`/campaigns/${campaign.id}/forms`, 'POST', { title: 'Welcome form', fields: fields(config) });
  assert.equal(created.status, 201, await created.clone().text()); const form = await created.json() as any;
  assert.equal((await request(`/campaigns/${campaign.id}/forms/${form.id}/publish`, 'POST', {})).status, 201);
  return form;
}
async function submit(form: any) { const r = await fetch(api + '/forms/public/' + form.publicSlug + '/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: { name: 'Customer', mobile: '9876543210', order_number: 'ENQ-42' } }) }); assert.equal(r.status, 201, await r.clone().text()); await app.get(OutboxService).publishFormGreetings(); return r.json() as Promise<any>; }

test('template sync keeps media/button metadata, approval states and parameter count without exposing credentials', async () => {
  const result = await request('/integrations/gupshup/templates'); assert.equal(result.status, 200);
  const list = await result.json() as any; const t = list.templates.find((t: any) => t.id === 'tpl-image');
  assert.equal(t.mediaUrl, media); assert.equal(t.mediaId, 'provider-media'); assert.equal(t.parameterCount, 2); assert.equal(t.buttons[1].text, 'Contact me');
  assert.equal(t.status, 'APPROVED'); assert.ok(!JSON.stringify(list).includes('fixture-only-api-key'));
  assert.equal(list.templates.find((t: any) => t.id === 'tpl-rejected').status, 'REJECTED');
  assert.equal((await request('/integrations/gupshup/sync-templates', 'POST', {}, userToken)).status, 403);
  assert.equal((await request('/integrations/gupshup/templates', 'GET', undefined, userToken)).status, 200);
});

test('failed synchronization preserves the previous catalog', async () => {
  (provider as any).http.get = () => throwError(() => ({ response: { status: 503, data: { message: 'Fixture unavailable' } } }));
  const result = await catalog.sync(); assert.equal(result.success, false);
  assert.equal((await catalog.list()).templates.length, providerTemplates().length);
});

test('form configuration rejects free-form-only greetings, unapproved templates and incomplete mappings', async () => {
  for (const config of [{ greetingMessage: 'Hello {{name}}' }, { ...templateConfig(), templateId: 'tpl-rejected' }, { ...templateConfig(), params: ['{{name}}'] }, { ...templateConfig(), params: ['{{name}}', '{{missing_field}}'] }, { ...templateConfig(), templateId: 'tpl-dynamic' }]) {
    assert.equal((await request(`/campaigns/${campaign.id}/forms`, 'POST', { title: 'Invalid form', fields: fields(config) })).status, 400);
  }
  assert.equal((await database.db.select().from(forms)).length, 0);
});

test('public submission atomically persists a template request with mapped variables and the configured mobile field', async () => {
  const form = await makeForm(); const result = await submit(form);
  assert.equal(result.lead.phone, '9876543210'); assert.equal(result.lead.doerId, salesperson.id);
  const [event] = await database.db.select().from(outboxEvents); const payload = event.payload as any;
  assert.equal(event.eventType, JOB_TYPES.WHATSAPP_FORM_GREETING); assert.equal(payload.templateId, 'tpl-image');
  assert.deepEqual(payload.params, ['Customer', 'ENQ-42']); assert.equal(payload.mediaUrl, media); assert.equal(payload.leadId, result.lead.id);
  assert.equal(posts.length, 0, 'The public form request must not send a session message or call the provider');
  assert.ok(!JSON.stringify(payload).includes('fixture-only-api-key'));
});

test('disabled form communication produces no WhatsApp request', async () => {
  const form = await makeForm({ whatsappEnabled: false, greetingMessage: 'Legacy text' });
  await submit(form); assert.equal((await database.db.select().from(outboxEvents)).length, 0); assert.equal(posts.length, 0);
});

test('template sends use the exact template endpoint/parameters/media envelope and log the complete approved message', async () => {
  const result = await catalog.send('9876543210', 'tpl-image', ['Customer', 'ENQ-42'], media);
  assert.ok(result.messageId); assert.equal(posts.length, 1); const sent = posts[0];
  assert.equal(sent.url, 'https://api.gupshup.io/wa/api/v1/template/msg'); assert.equal(sent.form.get('destination'), '919876543210');
  assert.deepEqual(JSON.parse(sent.form.get('template')!), { id: 'tpl-image', params: ['Customer', 'ENQ-42'] });
  assert.deepEqual(JSON.parse(sent.form.get('message')!), { type: 'image', image: { link: media } });
  const [saved] = await database.db.select().from(whatsappMessages); assert.equal(saved.message, 'Hello Customer, enquiry ENQ-42');
  assert.equal((saved.raw as any).templateButtons.length, 2); assert.equal(saved.mediaUrl, media);
});

test('text, document and video templates use provider-defined headers without converting to session messages', async () => {
  for (const type of ['text', 'document', 'video']) {
    await catalog.send('919876543210', 'tpl-' + type, ['Customer', 'ENQ-42']);
    const message = JSON.parse(posts.at(-1)!.form.get('message')!);
    assert.equal(message.type, type); if (type !== 'text') assert.ok(message[type].link.startsWith('https://files.example.test/'));
  }
  assert.ok(posts.every(p => p.url.endsWith('/template/msg')));
});

test('provider rejection and invalid media/variables never fall back to a session message', async () => {
  await assert.rejects(catalog.send('919876543210', 'tpl-image', ['Customer', 'ENQ'], 'javascript:alert(1)'), /public HTTP/);
  await assert.rejects(catalog.send('919876543210', 'tpl-image', ['Customer']), /2 non-empty/);
  assert.equal(posts.length, 0);
  (provider as any).http.post = () => response({ status: 'error', message: 'Template rejected' });
  await assert.rejects(catalog.send('919876543210', 'tpl-text', ['Customer', 'ENQ']), /Template rejected/);
  assert.equal((await database.db.select().from(whatsappMessages)).length, 0);
});

test('reprocessing the same automation key sends and logs one message', async () => {
  const [lead] = await database.db.insert(leads).values({ campaignId: campaign.id, name: 'Customer', phone: '919876543210', doerId: salesperson.id }).returning();
  const opts = { leadId: lead.id, campaignId: campaign.id, automationKey: 'form-submission:' + randomUUID() };
  await Promise.all(Array.from({ length: 3 }, () => catalog.send('919876543210', 'tpl-image', ['Customer', 'ENQ'], media, opts)));
  assert.equal(posts.length, 1); assert.equal((await database.db.select().from(whatsappMessages)).length, 1);
});

test('unsupported component and variable formats cannot be used as ordinary positional templates', () => {
  for (const extra of [
    { parameterFormat: 'NAMED' },
    { components: [{ type: 'CAROUSEL', cards: [] }] },
    { components: [{ type: 'HEADER', format: 'TEXT', text: 'Account {{1}}' }] },
  ]) {
    const template = normalizeTemplate({ id: 'unsupported', status: 'APPROVED', templateType: 'TEXT', data: 'Hello {{1}}', ...extra }, 'fixture-app');
    assert.equal(template.supported, false);
    assert.ok(template.unsupportedReason);
  }
});

test('assigned sales users can queue the configured campaign status template', async () => {
  const config = { templateId: 'tpl-image', params: ['{{name}}', '{{source}}'], mediaUrl: media };
  assert.equal((await request(`/campaigns/${campaign.id}/statuses/${status.id}`, 'PUT', { whatsappTemplate: config })).status, 200);
  const [lead] = await database.db.insert(leads).values({ campaignId: campaign.id, name: 'Customer', source: 'website', phone: '919876543210', doerId: salesperson.id }).returning();
  assert.equal((await request(`/leads/${lead.id}/status`, 'PUT', { status: 'New', statusId: status.id, sendWhatsapp: true }, userToken)).status, 200);
  assert.equal((await database.db.select().from(outboxEvents)).length, 1);
  assert.equal((await request(`/leads/${lead.id}/status`, 'PUT', { status: 'New', statusId: status.id, sendWhatsapp: false }, userToken)).status, 200);
  const update = await request(`/leads/${lead.id}/status`, 'PUT', { status: 'New', statusId: status.id, sendWhatsapp: true });
  assert.equal(update.status, 200, await update.clone().text()); await app.get(OutboxService).publishFormGreetings();
  const [event] = await database.db.select().from(outboxEvents);
  assert.deepEqual((event.payload as any).params, ['Customer', 'website']); assert.equal((event.payload as any).templateId, 'tpl-image');
  assert.equal((await request(`/campaigns/${campaign.id}/statuses/${status.id}`, 'PUT', { whatsappTemplate: null })).status, 200);
  assert.equal((await database.db.select().from(campaignStatuses).where(eq(campaignStatuses.id, status.id)))[0].whatsappTemplate, null);
});

test('queued greetings do not send after DND, deletion, or a recipient change', async () => {
  for (const change of [{ dnd: true }, { isDeleted: true }, { phone: '919876543211' }]) {
    const [lead] = await database.db.insert(leads).values({ campaignId: campaign.id, name: 'Customer', phone: '919876543210', ...change }).returning();
    await assert.rejects(catalog.send('919876543210', 'tpl-image', ['Customer', 'ENQ'], media, { leadId: lead.id, automationKey: randomUUID() }));
  }
  assert.equal(posts.length, 0);
});

test('a queue outage preserves the form greeting for later recovery', async () => {
  const jobs = app.get(JobService); const original = jobs.addJob.bind(jobs);
  jobs.addJob = async () => { throw new Error('Fixture queue outage'); };
  try {
    const form = await makeForm(); await submit(form);
    const [pending] = await database.db.select().from(outboxEvents);
    assert.equal(pending.published, false); assert.ok(pending.retryCount > 0);
    assert.equal((await database.db.select().from(leads)).length, 1);
    for (let i = 0; i < 5; i++) await app.get(OutboxService).publishFormGreetings();
    assert.equal((await database.db.select().from(outboxEvents))[0].published, false);
  } finally { jobs.addJob = original; }
  assert.equal(await app.get(OutboxService).publishFormGreetings(), 1);
  assert.equal((await database.db.select().from(outboxEvents))[0].published, true);
});

test('a form transaction failure cannot leave a WhatsApp greeting without its enquiry', async () => {
  const form = await makeForm();
  await database.getPool().query(`CREATE FUNCTION reject_template_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Fixture transaction failure'; END $$;
    CREATE TRIGGER reject_template_outbox BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION reject_template_outbox()`);
  try {
    const r = await fetch(api + '/forms/public/' + form.publicSlug + '/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: { name: 'Customer', mobile: '9876543210', order_number: 'ENQ-42' } }) });
    assert.equal(r.status, 500);
    assert.equal((await database.db.select().from(leads)).length, 0);
    assert.equal((await database.db.select().from(outboxEvents)).length, 0);
    assert.equal(posts.length, 0);
  } finally { await database.getPool().query('DROP TRIGGER reject_template_outbox ON "OutboxEvent"; DROP FUNCTION reject_template_outbox()'); }
});

test('an approved template removed by a later sync cannot be sent', async () => {
  templateRows = []; await catalog.sync();
  await assert.rejects(catalog.send('919876543210', 'tpl-image', ['Customer', 'ENQ'], media), /approved Gupshup template/);
  assert.equal(posts.length, 0);
});

test('the Apps Script session media formats remain available for explicit session sends', async () => {
  for (const [type, expected] of [['image', { type: 'image', originalUrl: media, caption: 'Caption' }], ['document', { type: 'file', url: media, caption: 'Caption' }], ['video', { type: 'video', url: media, caption: 'Caption' }]] as const) {
    await provider.sendMediaSessionMessage('fixture-key', '919111111111', 'FixtureApp', '919876543210', type, media, 'Caption');
    assert.deepEqual(JSON.parse(posts.at(-1)!.form.get('message')!), expected);
    assert.equal(posts.at(-1)!.url, 'https://api.gupshup.io/wa/api/v1/msg');
  }
});

test('queued campaign messages are cancelled if the lead moves to another campaign', async () => {
  const [other] = await database.db.insert(campaigns).values({ name: 'Transferred campaign' }).returning();
  const [lead] = await database.db.insert(leads).values({ campaignId: other.id, name: 'Customer', phone: '919876543210' }).returning();
  await assert.rejects(catalog.send('919876543210', 'tpl-image', ['Customer', 'ENQ'], media,
    { leadId: lead.id, campaignId: campaign.id, automationKey: randomUUID() }), /another campaign/);
  assert.equal(posts.length, 0);
});

test('sales users cannot use status templates for unassigned leads or arbitrary sends', async () => {
  const [lead] = await database.db.insert(leads).values({ campaignId: campaign.id, name: 'Other lead', phone: '919876543210', doerId: admin.id }).returning();
  assert.equal((await request(`/leads/${lead.id}/status`, 'PUT', { status: 'New', statusId: status.id, sendWhatsapp: true }, userToken)).status, 403);
  assert.equal((await request(`/campaigns/${campaign.id}/statuses/${status.id}`, 'PUT', { whatsappTemplate: templateConfig() }, userToken)).status, 403);
  assert.equal((await request('/whatsapp/send/template', 'POST', { phone: lead.phone, templateId: 'tpl-image', templateParams: ['Other lead', 'ENQ'] }, userToken)).status, 403);
  assert.equal((await database.db.select().from(outboxEvents)).length, 0);
});

test('delivery diagnostics expose provider failures to admins without exposing queued payloads or credentials', async () => {
  const [lead] = await database.db.insert(leads).values({ campaignId: campaign.id, name: 'Customer', phone: '919876543210', doerId: salesperson.id }).returning();
  const payload = { templateId: 'tpl-text', params: ['Customer', 'ENQ'], leadId: lead.id, campaignId: campaign.id, phone: lead.phone!, automationKey: randomUUID() };
  (provider as any).http.post = () => response({ status: 'error', message: 'Template rejected by provider' });
  await assert.rejects(app.get(JobExecutionService).run(JOB_TYPES.WHATSAPP_FORM_GREETING, payload, () => catalog.sendAutomation(payload)), /Template rejected by provider/);
  assert.equal((await request('/integrations/gupshup/templates/delivery', 'GET', undefined, userToken)).status, 403);
  const result = await request('/integrations/gupshup/templates/delivery'); assert.equal(result.status, 200);
  const delivery = await result.json() as any;
  assert.equal(delivery.attempts[0].status, 'failed'); assert.match(delivery.attempts[0].error, /Template rejected by provider/);
  assert.equal(delivery.attempts[0].templateId, 'tpl-text');
  assert.ok(!JSON.stringify(delivery).includes('fixture-only-api-key')); assert.ok(!JSON.stringify(delivery).includes('919876543210'));
});

test('the API alone recovers pending greetings and sends new form and sales follow-up templates', { timeout: 45000 }, async () => {
  const form = await makeForm(); const first = await submit(form);
  // Simulate a restart after the lead commits but before its outbox event queues.
  await database.getPool().query('TRUNCATE pgboss.job CASCADE');
  await database.db.update(outboxEvents).set({ published: false, publishedAt: null });
  await app.close(); await startApi(true);
  const rows = await waitForMessages(1);
  assert.equal(rows[0].message, 'Hello Customer, enquiry ENQ-42');
  assert.equal((await database.db.select().from(outboxEvents))[0].published, true);

  await submit(form); await waitForMessages(2);
  assert.equal((await request(`/campaigns/${campaign.id}/statuses/${status.id}`, 'PUT', { whatsappTemplate: templateConfig() })).status, 200);
  const update = await request(`/leads/${first.lead.id}/status`, 'PUT', { status: 'New', statusId: status.id, sendWhatsapp: true }, userToken);
  assert.equal(update.status, 200, await update.clone().text()); await waitForMessages(3);
  assert.equal(posts.length, 3); assert.ok(posts.every(p => p.url.endsWith('/template/msg')));

  const delivery = await (await request('/integrations/gupshup/templates/delivery')).json() as any;
  assert.equal(delivery.senderRunning, true); assert.equal(delivery.pending, 0);
  assert.equal(delivery.attempts.filter((a: any) => a.status === 'completed').length, 3);
  assert.ok(!JSON.stringify(delivery).includes('fixture-only-api-key'));
});
