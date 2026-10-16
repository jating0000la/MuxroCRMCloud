import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import { campaigns, campaignStatuses, campaignUsers, followups, ivrCalls, ivrWebhookEvents, leads, settingAuditLogs, settings, users } from '../../db/schema';
import { EncryptionService } from '../../settings/encryption.service';
import { RoundRobinService, AllocationTransaction } from '../../common/services/round-robin.service';
import { CloudConnectConfigDto, IvrListQueryDto } from './cloudconnect.dto';
import { createPaginatedResponse } from '../../common/pagination.dto';

const CONFIG_KEY = 'cloudconnectSecretConfig';
const BACKUP_LOCK = 1465078355;
type Config = CloudConnectConfigDto & { tokenHash?: string };
type Event = { externalCallId: string; providerCallId: string; phone: string; status: 'ringing' | 'answered' | 'ended'; agentId: string | null; operatorName: string | null; transferId: string; reason: string };
const blankConfig = (): Config => ({ enabled: false, tenantId: '', crmCampaignId: '', inboundCampaignIds: [], operators: [] });
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** Indian local formats are canonicalized; explicitly international numbers retain their country code. */
export function normalizeIvrPhone(value: string): string {
  if (!/^[+\d\s().-]+$/.test(value)) throw new BadRequestException('Invalid caller phone number');
  let phone = value.replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  if (phone.startsWith('+')) {
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new BadRequestException('Invalid caller phone number');
    return phone.slice(1);
  }
  if (/^0\d{10}$/.test(phone)) phone = phone.slice(1);
  if (/^\d{10}$/.test(phone)) return '91' + phone;
  if (/^91\d{10}$/.test(phone)) return phone;
  throw new BadRequestException('Use a valid Indian number or an international number with country code');
}

@Injectable()
export class CloudConnectService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private draining?: Promise<void>;
  constructor(private database: DatabaseService, private encryption: EncryptionService, private roundRobin: RoundRobinService) {}

  onModuleInit() {
    // API handles normal delivery immediately; the worker recovers durable pending events after a restart.
    if (process.env.CRM_PROCESS_ROLE === 'worker') {
      this.timer = setInterval(() => { void this.drainInbox().catch(() => {}); }, 5000);
      this.timer.unref();
    }
  }
  async onModuleDestroy() { if (this.timer) clearInterval(this.timer); await this.draining?.catch(() => {}); }

  private async readConfig(db: Pick<DatabaseService['db'], 'select'> = this.database.db): Promise<Config> {
    const [row] = await db.select().from(settings).where(eq(settings.key, CONFIG_KEY)).limit(1);
    if (!row) return blankConfig();
    // Fail closed if encryption/config is corrupt; never silently replace stored credentials.
    return JSON.parse(this.encryption.decrypt(row.encryptedValue));
  }
  async getConfig() {
    const { tokenHash, ...config } = await this.readConfig();
    return { ...config, webhookTokenConfigured: Boolean(tokenHash) };
  }
  private async writeConfig(change: (current: Config) => Promise<Config>, userId: string) {
    return this.database.db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${CONFIG_KEY}))`);
      const config = await change(await this.readConfig(tx));
      const [saved] = await tx.insert(settings).values({ key: CONFIG_KEY, encryptedValue: this.encryption.encrypt(JSON.stringify(config)), isEncrypted: true })
        .onConflictDoUpdate({ target: settings.key, set: { encryptedValue: this.encryption.encrypt(JSON.stringify(config)), isEncrypted: true, updatedAt: new Date() } }).returning();
      await tx.insert(settingAuditLogs).values({ settingId: saved.id, action: 'update', changedBy: userId, newValue: '[CloudConnect configuration updated]' });
      return config;
    });
  }
  private async ensureCampaignReady(campaignId: string, requireUsers: boolean, db: Pick<DatabaseService['db'], 'select'> = this.database.db) {
    const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.isActive, true))).limit(1);
    if (!campaign) throw new BadRequestException('Select an active CRM campaign');
    if (requireUsers) {
      const [member] = await db.select({ id: users.id }).from(campaignUsers).innerJoin(users, eq(campaignUsers.userId, users.id))
        .where(and(eq(campaignUsers.campaignId, campaignId), eq(campaignUsers.isActive, true), eq(users.isActive, true), eq(users.role, 'USER'))).limit(1);
      if (!member) throw new BadRequestException('Assign active sales users to the CRM campaign before enabling IVR');
    }
  }
  async saveConfig(dto: CloudConnectConfigDto, userId: string) {
    if (new Set(dto.operators.map(op => op.agentId)).size !== dto.operators.length) throw new BadRequestException('Operator Agent IDs must be unique');
    if (dto.enabled && !dto.inboundCampaignIds.length) throw new BadRequestException('Add at least one incoming CloudConnect campaign ID');
    if (dto.enabled) await this.ensureCampaignReady(dto.crmCampaignId, true);
    await this.writeConfig(async current => {
      if (dto.enabled && !current.tokenHash) throw new BadRequestException('Generate the webhook token before enabling IVR');
      return { ...dto, tokenHash: current.tokenHash };
    }, userId);
    return this.getConfig();
  }
  async rotateToken(userId: string) {
    const token = randomBytes(32).toString('hex');
    await this.writeConfig(async current => ({ ...current, tokenHash: hash(token) }), userId);
    return { token };
  }
  private scalar(raw: Record<string, unknown>, key: string, required = false, max = 128): string {
    const value = raw[key];
    if (value === undefined || value === null || value === '') {
      if (required) throw new BadRequestException(`Missing ${key}`);
      return '';
    }
    if ((typeof value !== 'string' && typeof value !== 'number') || String(value).length > max || /[\x00-\x1f]/.test(String(value))) throw new BadRequestException(`Invalid ${key}`);
    return String(value).trim();
  }
  async receive(raw: Record<string, unknown>, token: string) {
    const config = await this.readConfig();
    const suppliedHash = hash(typeof token === 'string' ? token : '');
    if (!config.tokenHash || !/^[a-f0-9]{64}$/.test(config.tokenHash) || !timingSafeEqual(Buffer.from(suppliedHash), Buffer.from(config.tokenHash))) throw new UnauthorizedException('Invalid webhook token');
    if (!config.enabled) throw new ServiceUnavailableException('CloudConnect intake is disabled');
    const direction = this.scalar(raw, 'call_direction', true).toUpperCase();
    if (!['INBOUND', 'OUTBOUND'].includes(direction)) throw new BadRequestException('Unsupported call direction');
    const providerCampaign = this.scalar(raw, 'campaignId', true, 30);
    const tenant = this.scalar(raw, 'tenant_id', false, 30);
    if (tenant && tenant !== config.tenantId) throw new BadRequestException('Unexpected tenant');
    if (direction !== 'INBOUND' || !config.inboundCampaignIds.includes(providerCampaign)) return { accepted: true, ignored: true };
    const externalCallId = this.scalar(raw, 'call_uuid') || this.scalar(raw, 'callid', true);
    const providerCallId = this.scalar(raw, 'callid') || externalCallId;
    if (!/^[A-Za-z0-9_-]+$/.test(externalCallId) || !/^[A-Za-z0-9_-]+$/.test(providerCallId)) throw new BadRequestException('Invalid call identifier');
    const providerStatus = this.scalar(raw, 'status', true).toLowerCase();
    const status = providerStatus === 'ringing' ? 'ringing' : providerStatus === 'answered' ? 'answered' : providerStatus === 'hangup' ? 'ended' : null;
    if (!status) throw new BadRequestException('Unsupported call status');
    const agentId = this.scalar(raw, 'agent_id', false, 30) || null;
    if (agentId && !/^\d+$/.test(agentId)) throw new BadRequestException('Invalid agent ID');
    const event: Event = { externalCallId, providerCallId, phone: normalizeIvrPhone(this.scalar(raw, 'callernumber', true, 50)), status,
      agentId, operatorName: config.operators.find(op => op.agentId === agentId)?.name || null,
      transferId: this.scalar(raw, 'transfer_id', false, 30), reason: this.scalar(raw, 'reason', false, 100) };
    const eventKey = hash(JSON.stringify([config.tenantId, providerCampaign, externalCallId, event.phone, status, agentId, event.transferId, event.reason]));
    await this.database.db.transaction(async tx => {
      const lock = await tx.execute(sql`SELECT pg_try_advisory_xact_lock_shared(${BACKUP_LOCK}) AS acquired`);
      if (!lock.rows[0]?.acquired) throw new ServiceUnavailableException('Database maintenance in progress; retry callback');
      await this.ensureCampaignReady(config.crmCampaignId, false, tx);
      await tx.insert(ivrWebhookEvents).values({ eventKey, tenantId: config.tenantId, externalCallId, crmCampaignId: config.crmCampaignId, payload: event })
        .onConflictDoNothing({ target: ivrWebhookEvents.eventKey });
    });
    void this.drainInbox().catch(() => {});
    return { accepted: true };
  }
  async drainInbox(): Promise<void> {
    if (this.draining) return this.draining;
    this.draining = this.processBatch().finally(() => { this.draining = undefined; });
    return this.draining;
  }
  private async processBatch() {
    for (let n = 0; n < 50; n++) {
      let failedEvent: typeof ivrWebhookEvents.$inferSelect | undefined;
      try {
        const worked = await this.database.db.transaction(async tx => {
          const lock = await tx.execute(sql`SELECT pg_try_advisory_xact_lock_shared(${BACKUP_LOCK}) AS acquired`);
          if (!lock.rows[0]?.acquired) return false;
          const [event] = await tx.select().from(ivrWebhookEvents)
            .where(and(eq(ivrWebhookEvents.status, 'pending'), sql`${ivrWebhookEvents.nextAttemptAt} <= now()`))
            .orderBy(asc(ivrWebhookEvents.createdAt), asc(ivrWebhookEvents.id)).limit(1).for('update', { skipLocked: true });
          if (!event) return false;
          failedEvent = event;
          await this.applyEvent(tx, event);
          await tx.update(ivrWebhookEvents).set({ status: 'processed', processedAt: new Date(), error: null, attempts: event.attempts + 1 }).where(eq(ivrWebhookEvents.id, event.id));
          return true;
        });
        if (!worked) break;
      } catch {
        if (!failedEvent) throw new ServiceUnavailableException('IVR inbox temporarily unavailable');
        const event = failedEvent;
        await this.database.db.update(ivrWebhookEvents).set({ attempts: sql`${ivrWebhookEvents.attempts} + 1`,
          status: event.attempts >= 4 ? 'failed' : 'pending', error: 'Processing failed. Check that the campaign is active and has active sales users; then retry.',
          nextAttemptAt: new Date(Date.now() + Math.min(60000, 5000 * 2 ** event.attempts)) })
          .where(and(eq(ivrWebhookEvents.id, event.id), eq(ivrWebhookEvents.status, 'pending')));
      }
    }
  }
  private async applyEvent(tx: AllocationTransaction, inbox: typeof ivrWebhookEvents.$inferSelect) {
    const event = inbox.payload as Event;
    // One campaign lock covers concurrent calls from the same caller, assignment, and call updates.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${inbox.crmCampaignId}))`);
    await this.ensureCampaignReady(inbox.crmCampaignId, false, tx);
    const [existing] = await tx.select().from(ivrCalls).where(and(eq(ivrCalls.tenantId, inbox.tenantId), eq(ivrCalls.externalCallId, inbox.externalCallId))).limit(1).for('update');
    if (existing && (existing.crmCampaignId !== inbox.crmCampaignId || existing.phone !== event.phone)) throw new BadRequestException('Call identity conflict');
    let leadId = existing?.leadId;
    if (!leadId) {
      // Preserve ownership, status and DND for repeat callers; never match across campaigns.
      const candidates = await tx.select({ id: leads.id }).from(leads).where(and(eq(leads.campaignId, inbox.crmCampaignId), eq(leads.isDeleted, false),
        sql`CASE WHEN regexp_replace(coalesce(${leads.phone}, ''), '[^0-9]', '', 'g') ~ '^0[0-9]{10}$'
          THEN '91' || right(regexp_replace(${leads.phone}, '[^0-9]', '', 'g'), 10)
          WHEN regexp_replace(coalesce(${leads.phone}, ''), '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
          THEN '91' || regexp_replace(${leads.phone}, '[^0-9]', '', 'g')
          ELSE regexp_replace(coalesce(${leads.phone}, ''), '[^0-9]', '', 'g') END = ${event.phone}`))
        .orderBy(desc(leads.createdAt), desc(leads.id)).limit(1).for('update');
      leadId = candidates[0]?.id;
      if (!leadId) {
        const doerId = await this.roundRobin.getNextRoundRobinUser(inbox.crmCampaignId, tx);
        const [status] = await tx.select().from(campaignStatuses).where(eq(campaignStatuses.campaignId, inbox.crmCampaignId)).orderBy(asc(campaignStatuses.order), asc(campaignStatuses.id)).limit(1);
        const [lead] = await tx.insert(leads).values({ campaignId: inbox.crmCampaignId, phone: event.phone, name: `IVR caller ${event.phone}`, source: 'ivr', doerId, statusId: status?.id }).returning();
        leadId = lead.id;
        await tx.insert(followups).values({ leadId, userId: doerId, status: status?.label || 'New', remarks: 'New incoming IVR enquiry; assigned for sales follow-up.' });
      }
    }
    const answered = Boolean(existing?.answered || event.status === 'answered');
    const ended = existing?.status === 'ended' || event.status === 'ended';
    const status = ended ? 'ended' : answered ? 'answered' : 'ringing';
    const agentChange = event.status !== 'ringing' || !existing?.answered;
    const values = { status, answered, callbackNeeded: ended && !answered,
      ...(agentChange && event.agentId ? { agentId: event.agentId, operatorName: event.operatorName } : {}),
      lastEventAt: inbox.createdAt, endedAt: existing?.endedAt || (ended ? inbox.createdAt : null) };
    if (existing) await tx.update(ivrCalls).set(values).where(eq(ivrCalls.id, existing.id));
    else await tx.insert(ivrCalls).values({ tenantId: inbox.tenantId, externalCallId: inbox.externalCallId, providerCallId: event.providerCallId,
      crmCampaignId: inbox.crmCampaignId, leadId, phone: event.phone, receivedAt: inbox.createdAt, ...values });
  }
  async listCalls(query: IvrListQueryDto, userId: string, role: string) {
    if (query.leadId) {
      const [lead] = await this.database.db.select().from(leads).where(and(eq(leads.id, query.leadId), eq(leads.isDeleted, false))).limit(1);
      if (!lead) throw new NotFoundException('Lead not found');
      if (role !== 'ADMIN' && lead.doerId !== userId) throw new ForbiddenException('Lead is not assigned to you');
    } else if (role !== 'ADMIN') throw new ForbiddenException('Only admins can list all IVR calls');
    const where = and(eq(leads.isDeleted, false), role !== 'ADMIN' ? eq(leads.doerId, userId) : undefined, query.leadId ? eq(ivrCalls.leadId, query.leadId) : undefined);
    const [rows, [count]] = await Promise.all([
      this.database.db.select({ call: ivrCalls }).from(ivrCalls).innerJoin(leads, eq(ivrCalls.leadId, leads.id)).where(where)
        .orderBy(desc(ivrCalls.receivedAt), desc(ivrCalls.id)).limit(query.limit).offset((query.page - 1) * query.limit),
      this.database.db.select({ total: sql<number>`count(*)::int` }).from(ivrCalls).innerJoin(leads, eq(ivrCalls.leadId, leads.id)).where(where),
    ]);
    return createPaginatedResponse(rows.map(row => row.call), count.total, query.page, query.limit);
  }
  async listEvents(query: IvrListQueryDto) {
    const [rows, [count]] = await Promise.all([
      this.database.db.select({ id: ivrWebhookEvents.id, externalCallId: ivrWebhookEvents.externalCallId, status: ivrWebhookEvents.status,
        attempts: ivrWebhookEvents.attempts, error: ivrWebhookEvents.error, createdAt: ivrWebhookEvents.createdAt, processedAt: ivrWebhookEvents.processedAt })
        .from(ivrWebhookEvents).orderBy(desc(ivrWebhookEvents.createdAt), desc(ivrWebhookEvents.id)).limit(query.limit).offset((query.page - 1) * query.limit),
      this.database.db.select({ total: sql<number>`count(*)::int` }).from(ivrWebhookEvents),
    ]);
    return createPaginatedResponse(rows, count.total, query.page, query.limit);
  }
  async retryEvent(id: string) {
    const [row] = await this.database.db.update(ivrWebhookEvents).set({ status: 'pending', attempts: 0, error: null, nextAttemptAt: new Date() })
      .where(and(eq(ivrWebhookEvents.id, id), inArray(ivrWebhookEvents.status, ['pending', 'failed']))).returning();
    if (!row) throw new NotFoundException('Pending or failed event not found');
    void this.drainInbox().catch(() => {});
    return { accepted: true };
  }
}
