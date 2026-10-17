import { GupshupTemplatesService } from '../integrations/templates/gupshup-templates.service';
import { normalizeWhatsAppPhone, whatsappPhoneSql } from './phone';
import { AllocationTransaction } from '../common/services/round-robin.service';
import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { SQLWrapper, eq, and, desc, asc, like, sql, isNull, or } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { SettingsService } from '../settings/settings.service';
import { RoundRobinService } from '../common/services/round-robin.service';
import { whatsappMessages, whatsappContacts, leads, campaigns, followups, campaignStatuses } from '../db/schema';

export interface GupshupMessageResponse {
  status: string;
  messageId: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly SESSION_MSG_URL = 'https://api.gupshup.io/wa/api/v1/msg';
  private readonly TEMPLATE_MSG_URL = 'https://api.gupshup.io/wa/api/v1/template/msg';

  constructor(
    private http: HttpService,
    private database: DatabaseService,
    private settingsService: SettingsService,
    private roundRobinService: RoundRobinService,
    private templates: GupshupTemplatesService,
  ) {}

  // ─── Config Resolution ────────────────────────────────────────────────────

  async getConfig(): Promise<{ apiKey: string; source: string; appName: string; appId: string }> {
    const [apiKey, source, appName, appId] = await Promise.all([
      this.settingsService.getSettingForUse('gupshupApiKey'),
      this.settingsService.getSettingForUse('gupshupSource'),
      this.settingsService.getSettingForUse('gupshupAppName'),
      this.settingsService.getSettingForUse('gupshupAppId').catch(() => ''),
    ]);
    return { apiKey, source, appName, appId };
  }

  // ─── Chat Inbox ───────────────────────────────────────────────────────────

  private paginationBounds(limit: number, offset: number) {
    if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(offset) || offset < 0 || offset > 2147483647) {
      throw new BadRequestException('Pagination requires a positive integer limit and a nonnegative integer offset');
    }
    return { limit: Math.min(limit, 500), offset };
  }

  private rowScope(leadId: SQLWrapper, phone: SQLWrapper, userId: string, role: string) {
    if (role === 'ADMIN') return sql`true`;
    if (role !== 'USER' || !userId) return sql`false`;
    // Linked records follow their lead, never another lead sharing the phone.
    // Legacy unlinked records are visible only when the phone has no other owner.
    return sql`EXISTS (
      SELECT 1 FROM "Lead" owned
      WHERE owned."isDeleted" = false AND owned."doerId" = ${userId}
        AND (owned.id = ${leadId} OR (${leadId} IS NULL
          AND ${whatsappPhoneSql(sql`owned.phone`)} = ${whatsappPhoneSql(phone)}
          AND NOT EXISTS (SELECT 1 FROM "Lead" other
            WHERE ${whatsappPhoneSql(sql`other.phone`)} = ${whatsappPhoneSql(phone)}
              AND other."doerId" IS DISTINCT FROM ${userId})))
    )`;
  }

  async getChats(userId: string, role: string, limit = 50, offset = 0) {
    ({ limit, offset } = this.paginationBounds(limit, offset));
    const chats = await this.database.db.execute(sql`
      WITH visible AS (
        SELECT wm.*, ${whatsappPhoneSql(sql`wm.phone`)} AS "canonicalPhone" FROM "WhatsappMessage" wm
        WHERE ${this.rowScope(sql`wm."leadId"`, sql`wm.phone`, userId, role)}
      ), latest AS (
        SELECT DISTINCT ON ("canonicalPhone") * FROM visible
        ORDER BY "canonicalPhone", "createdAt" DESC, id DESC
      )
      SELECT wm."canonicalPhone" AS phone, COALESCE(wm.name, wc.name, '') as name,
        wm.message as "lastMessage", wm."createdAt" as "lastMessageAt",
        wm.direction as "lastDirection", wm.type as "lastType",
        (SELECT COUNT(*) FROM visible unread
          WHERE unread."canonicalPhone" = wm."canonicalPhone" AND unread.direction = 'in'
            AND unread.status = 'received') as "unreadCount",
        (SELECT COUNT(*) FROM visible all_messages WHERE all_messages."canonicalPhone" = wm."canonicalPhone") as "totalMessages"
      FROM latest wm
      LEFT JOIN "WhatsappContact" wc ON wc.phone = wm."canonicalPhone"
        AND ${this.rowScope(sql`wc."leadId"`, sql`wc.phone`, userId, role)}
      ORDER BY wm."createdAt" DESC, wm.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    return chats.rows.map((row: any) => ({
      phone: row.phone, name: row.name || row.phone, lastMessage: row.lastMessage || '',
      lastMessageAt: row.lastMessageAt, lastDirection: row.lastDirection,
      lastType: row.lastType, lastMessageType: row.lastType, unreadCount: Number(row.unreadCount) || 0,
      totalMessages: Number(row.totalMessages) || 0,
    }));
  }

  async getChatMessages(phone: string, userId: string, role: string, limit = 50, offset = 0) {
    ({ limit, offset } = this.paginationBounds(limit, offset));
    const messages = await this.database.db.select().from(whatsappMessages)
      .where(and(sql`${whatsappPhoneSql(whatsappMessages.phone)} = ${this.normalizePhone(phone)}`,
        this.rowScope(whatsappMessages.leadId, whatsappMessages.phone, userId, role)))
      .orderBy(desc(whatsappMessages.createdAt), desc(whatsappMessages.id))
      .limit(limit).offset(offset);
    return messages.reverse();
  }

  async getChatStats(userId: string, role: string) {
    const [stats] = await this.database.db.select({
      totalMessages: sql<number>`count(*)::int`,
      incoming: sql<number>`count(*) FILTER (WHERE ${whatsappMessages.direction} = 'in')::int`,
      outgoing: sql<number>`count(*) FILTER (WHERE ${whatsappMessages.direction} = 'out')::int`,
      uniqueChats: sql<number>`count(DISTINCT ${whatsappPhoneSql(whatsappMessages.phone)})::int`,
    }).from(whatsappMessages)
      .where(this.rowScope(whatsappMessages.leadId, whatsappMessages.phone, userId, role));
    return { ...stats, incomingMessages: stats.incoming, outgoingMessages: stats.outgoing };
  }

  async ensureSendAccess(dto: { phone: string; leadId?: string; campaignId?: string }, user: { id: string; role: string }) {
    if (user.role === 'ADMIN' && !dto.leadId) return { leadId: dto.leadId, campaignId: dto.campaignId };
    const [lead] = await this.database.db.select({ id: leads.id, campaignId: leads.campaignId }).from(leads)
      .where(and(eq(leads.isDeleted, false),
        sql`${whatsappPhoneSql(leads.phone)} = ${this.normalizePhone(dto.phone)}`,
        dto.leadId ? eq(leads.id, dto.leadId) : undefined,
        dto.campaignId ? eq(leads.campaignId, dto.campaignId) : undefined,
        user.role === 'ADMIN' ? undefined : eq(leads.doerId, user.id)))
      .orderBy(desc(leads.createdAt), desc(leads.id)).limit(1);
    if (!lead || !['ADMIN', 'USER'].includes(user.role)) throw new ForbiddenException('You can only message leads assigned to you');
    return { leadId: lead.id, campaignId: lead.campaignId };
  }

  // ─── Message Sending ──────────────────────────────────────────────────────

  async sendText(phone: string, text: string, previewUrl = false, opts?: { leadId?: string; campaignId?: string; userId?: string }) {
    const cfg = await this.getConfig();
    const dest = this.normalizePhone(phone);

    const payload: any = {
      type: 'text',
      text,
      previewUrl,
    };

    const result = await this.sendToGupshup(cfg, dest, payload);
    const name = await this.getContactName(dest);
    await this.logMessage(dest, text, 'out', 'text', undefined, result, { ...opts, name });
    return result;
  }

  async sendImage(phone: string, url: string, caption?: string, opts?: { leadId?: string; campaignId?: string; userId?: string }) {
    const cfg = await this.getConfig();
    const dest = this.normalizePhone(phone);

    const payload: any = {
      type: 'image',
      originalUrl: url,
      previewUrl: url,
      caption: caption || '',
    };

    const result = await this.sendToGupshup(cfg, dest, payload);
    const name = await this.getContactName(dest);
    await this.logMessage(dest, caption || '[Image]', 'out', 'image', url, result, { ...opts, name });
    return result;
  }

  async sendVideo(phone: string, url: string, caption?: string, opts?: { leadId?: string; campaignId?: string; userId?: string }) {
    const cfg = await this.getConfig();
    const dest = this.normalizePhone(phone);

    const payload: any = {
      type: 'video',
      url,
      caption: caption || '',
    };

    const result = await this.sendToGupshup(cfg, dest, payload);
    const name = await this.getContactName(dest);
    await this.logMessage(dest, caption || '[Video]', 'out', 'video', url, result, { ...opts, name });
    return result;
  }

  async sendAudio(phone: string, url: string, opts?: { leadId?: string; campaignId?: string; userId?: string }) {
    const cfg = await this.getConfig();
    const dest = this.normalizePhone(phone);

    const payload: any = { type: 'audio', url };
    const result = await this.sendToGupshup(cfg, dest, payload);
    const name = await this.getContactName(dest);
    await this.logMessage(dest, '[Audio]', 'out', 'audio', url, result, { ...opts, name });
    return result;
  }

  async sendFile(phone: string, url: string, filename?: string, caption?: string, opts?: { leadId?: string; campaignId?: string; userId?: string }) {
    const cfg = await this.getConfig();
    const dest = this.normalizePhone(phone);

    const payload: any = {
      type: 'file',
      url,
      filename: filename || 'document.pdf',
    };

    const result = await this.sendToGupshup(cfg, dest, payload);
    const name = await this.getContactName(dest);
    await this.logMessage(dest, caption || filename || '[Document]', 'out', 'file', url, result, { ...opts, name });
    return result;
  }

  async sendLocation(phone: string, lat: string, lng: string, name?: string, address?: string, opts?: { leadId?: string; campaignId?: string; userId?: string }) {
    const cfg = await this.getConfig();
    const dest = this.normalizePhone(phone);

    const payload: any = {
      type: 'location',
      latitude: lat,
      longitude: lng,
      name: name || '',
      address: address || '',
    };

    const result = await this.sendToGupshup(cfg, dest, payload);
    const contactName = await this.getContactName(dest);
    await this.logMessage(dest, `[Location] ${name || ''} ${lat},${lng}`, 'out', 'location', undefined, result, { ...opts, name: contactName });
    return result;
  }

  async sendContact(phone: string, firstName: string, lastName?: string, contactPhone?: string, email?: string, company?: string, opts?: { leadId?: string; campaignId?: string; userId?: string }) {
    const cfg = await this.getConfig();
    const dest = this.normalizePhone(phone);

    const contact = {
      type: 'contact',
      contact: {
        name: {
          firstName,
          formattedName: `${firstName} ${lastName || ''}`.trim(),
          lastName: lastName || '',
        },
        phones: [{ phone: this.normalizePhone(contactPhone || phone), type: 'WORK' }],
        emails: email ? [{ email, type: 'Personal' }] : [],
        org: company ? { company } : {},
        addresses: [],
        birthday: '',
        urls: [],
      },
    };

    const result = await this.sendToGupshup(cfg, dest, contact);
    const contactName = await this.getContactName(dest);
    await this.logMessage(dest, `[Contact] ${firstName}`, 'out', 'contact', undefined, result, { ...opts, name: contactName });
    return result;
  }

  async sendQuickReply(phone: string, text: string, buttons: string, header?: string, footer?: string, opts?: { leadId?: string; campaignId?: string; userId?: string }) {
    const cfg = await this.getConfig();
    const dest = this.normalizePhone(phone);

    const options = buttons.split(',').map((b) => b.trim()).filter(Boolean).slice(0, 3).map((btn) => ({
      type: 'text',
      title: btn,
      postbackText: btn,
    }));

    const payload = {
      type: 'quick_reply',
      msgid: `qr_${Date.now()}`,
      version: 2,
      content: { type: 'text', header: header || '', text, footer: footer || '' },
      options,
    };

    const result = await this.sendToGupshup(cfg, dest, payload);
    const contactName = await this.getContactName(dest);
    await this.logMessage(dest, text, 'out', 'quick_reply', undefined, result, { ...opts, name: contactName });
    return result;
  }

  async sendList(phone: string, header: string, text: string, items: string, footer?: string, buttonLabel?: string, opts?: { leadId?: string; campaignId?: string; userId?: string }) {
    const cfg = await this.getConfig();
    const dest = this.normalizePhone(phone);

    const parsedItems = items.split('\n').map((line) => {
      const parts = line.split('|').map((p) => p.trim());
      return { type: 'text', title: parts[0], description: parts[1] || '', postbackText: parts[0] };
    }).filter((o) => o.title).slice(0, 10);

    const payload = {
      type: 'list',
      title: header,
      body: text,
      footer: footer || '',
      msgid: `list_${Date.now()}`,
      globalButtons: [{ type: 'text', title: buttonLabel || 'View options' }],
      items: [{ title: header, subtitle: '', options: parsedItems }],
    };

    const result = await this.sendToGupshup(cfg, dest, payload);
    const contactName = await this.getContactName(dest);
    await this.logMessage(dest, text, 'out', 'list', undefined, result, { ...opts, name: contactName });
    return result;
  }

  // ─── Template Messages ────────────────────────────────────────────────────

  async sendTemplate(phone: string, templateId: string, params?: string[], mediaType?: string, mediaUrl?: string, opts?: { leadId?: string; campaignId?: string; userId?: string }) {
    return this.templates.send(phone, templateId, params || [], mediaUrl, opts);
  }

  // ─── Broadcast ────────────────────────────────────────────────────────────

  async sendBroadcast(items: Array<{ phone: string; text?: string; templateId?: string; templateParams?: string[]; mode?: string }>) {
    if (items.length > 50) throw new BadRequestException('Max 50 messages per batch');

    const results: Array<{ phone: string; success: boolean; result?: any; error?: string }> = [];

    for (const item of items) {
      try {
        let result: GupshupMessageResponse;
        if (item.mode === 'template' && item.templateId) {
          result = await this.sendTemplate(item.phone, item.templateId, item.templateParams);
        } else {
          result = await this.sendText(item.phone, item.text || '');
        }
        results.push({ phone: item.phone, success: true, result });
      } catch (err: any) {
        results.push({ phone: item.phone, success: false, error: err.message });
      }
    }

    return {
      success: true,
      total: items.length,
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  // ─── Inbound Webhook Processing ───────────────────────────────────────────

  async processInbound(payload: any): Promise<{ status: string; messageId?: string }> {
    const inbound = this.parseInboundPayload(payload);
    if (!inbound) return { status: 'ignored' };
    const phone = this.normalizePhone(inbound.source);
    if (!/^\d{8,15}$/.test(phone)) throw new BadRequestException('Invalid WhatsApp sender phone');
    const autoCampaignId = await this.settingsService.getSettingForUse('whatsappAutoCampaignId').catch(error => {
      if (error?.getStatus?.() === 404) return '';
      throw error;
    });
    return this.database.db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'whatsapp:' + phone}))`);
      if (inbound.messageId) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'whatsapp-message:' + inbound.messageId}))`);
        const [duplicate] = await tx.select({ id: whatsappMessages.id, mediaUrl: whatsappMessages.mediaUrl }).from(whatsappMessages)
          .where(and(eq(whatsappMessages.messageId, inbound.messageId), eq(whatsappMessages.direction, 'in'))).limit(1);
        if (duplicate) {
          // Provider retries can recover a URL dropped by an older application version.
          if (!duplicate.mediaUrl && inbound.mediaUrl) await tx.update(whatsappMessages)
            .set({ mediaUrl: inbound.mediaUrl, message: String(inbound.message || '').slice(0, 2000) })
            .where(eq(whatsappMessages.id, duplicate.id));
          return { status: 'duplicate', messageId: inbound.messageId };
        }
      }
      let [lead] = await tx.select().from(leads)
        .where(and(sql`${whatsappPhoneSql(leads.phone)} = ${phone}`, eq(leads.isDeleted, false)))
        .orderBy(desc(leads.createdAt), desc(leads.id)).limit(1);
      if (!lead && autoCampaignId) lead = await this.createLeadFromWhatsApp(phone, inbound.name, autoCampaignId, tx);
      await tx.insert(whatsappContacts).values({ phone, name: inbound.name || '', leadId: lead?.id, lastSeen: new Date() })
        .onConflictDoUpdate({ target: whatsappContacts.phone, set: {
          name: inbound.name || sql`${whatsappContacts.name}`, lastSeen: new Date(), leadId: lead?.id || sql`${whatsappContacts.leadId}`,
        } });
      const text = typeof inbound.message === 'string' ? inbound.message : inbound.message?.text || inbound.message?.title || '';
      await tx.insert(whatsappMessages).values({ phone, name: (inbound.name || '').slice(0, 255), direction: 'in',
        message: String(text).slice(0, 2000), type: String(inbound.msgType || 'text').slice(0, 50),
        mediaUrl: inbound.mediaUrl, messageId: inbound.messageId || null, status: 'received', leadId: lead?.id, campaignId: lead?.campaignId });
      if (lead) {
        const [campaign] = await tx.select({ managerId: campaigns.managerId }).from(campaigns).where(eq(campaigns.id, lead.campaignId)).limit(1);
        const userId = lead.doerId || campaign?.managerId;
        if (userId) await tx.insert(followups).values({ leadId: lead.id, userId, status: 'WhatsApp Received',
          remarks: `${inbound.messageId ? '[msg:' + inbound.messageId + '] ' : ''}Inbound WhatsApp: ${String(text).slice(0, 500)}` });
      }
      return { status: 'ok', messageId: inbound.messageId };
    });
  }

  parseInboundPayload(payload: any): { source: string; name: string; message: any; msgType: string; messageId: string; mediaUrl?: string } | null {
    try {
      // Format 1: Gupshup native format { type: 'message', payload: { ... } }
      if (payload.type === 'message' && payload.payload) {
        const p = payload.payload;
        const innerPayload = p.payload || p.message || {};
        return {
          source: p.sender?.phone || p.source || p.phone || '',
          name: p.sender?.name || '',
          message: this.extractText({ ...innerPayload, type: p.type || innerPayload.type || 'text' }),
          msgType: p.type || innerPayload.type || 'text',
          mediaUrl: this.extractMediaUrl(innerPayload),
          messageId: p.id || p.context?.gsId || '',
        };
      }

      // Format 2: WhatsApp Business Platform { entry: [{ changes: [{ value: { messages: [...] } }] }] }
      if (payload.entry?.[0]?.changes?.[0]) {
        const value = payload.entry[0].changes[0].value || {};
        const messages = value.messages || [];
        const contacts = value.contacts || [];
        if (!messages.length) return null;
        const msg = messages[0];
        const contact = contacts[0] || {};
        return {
          source: contact.wa_id || msg.from || '',
          name: contact.profile?.name || '',
          message: this.extractText(msg),
          msgType: msg.type || 'text',
          mediaUrl: this.extractMediaUrl(msg),
          messageId: msg.id || '',
        };
      }

      // Format 3: Simple { user: { phone }, message: { text } }
      if (payload.user && payload.message) {
        return {
          source: payload.user.phone || payload.user.id || '',
          name: payload.user.name || '',
          message: this.extractText(payload.message),
          mediaUrl: this.extractMediaUrl(payload.message),
          msgType: payload.message.type || 'text',
          messageId: payload.message.id || '',
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  // ─── Contacts ─────────────────────────────────────────────────────────────

  async getContacts(userId: string, role: string, limit = 100, offset = 0) {
    ({ limit, offset } = this.paginationBounds(limit, offset));
    return this.database.db
      .select()
      .from(whatsappContacts)
      .where(this.rowScope(whatsappContacts.leadId, whatsappContacts.phone, userId, role))
      .orderBy(desc(whatsappContacts.lastSeen))
      .limit(limit)
      .offset(offset);
  }

  async upsertContact(phone: string, name?: string, leadId?: string) {
    const normalized = this.normalizePhone(phone);
    const [existing] = await this.database.db
      .select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.phone, normalized))
      .limit(1);

    if (existing) {
      await this.database.db
        .update(whatsappContacts)
        .set({
          name: name || existing.name,
          lastSeen: new Date(),
          leadId: leadId || existing.leadId,
        })
        .where(eq(whatsappContacts.id, existing.id));
    } else {
      await this.database.db.insert(whatsappContacts).values({
        phone: normalized,
        name: name || '',
        leadId,
        lastSeen: new Date(),
      });
    }
  }

  // ─── Template Sync ────────────────────────────────────────────────────────

  async syncTemplates() { return this.templates.sync(); }

  // ─── Delivery Status Update ───────────────────────────────────────────────

  async updateMessageStatus(
    messageId: string,
    status: string,
    metadata?: {
      pricing?: { category: string; billable?: boolean; pricingType: string };
      conversation?: { id: string; expirationTimestamp: number | null; originType: string };
      errorCode?: string;
      cause?: string;
    },
  ) {
    if (!messageId) return;

    // Build update with pricing/conversation data stored in raw column
    const updateData: any = { status };

    if (metadata && (metadata.pricing || metadata.conversation || metadata.errorCode || metadata.cause)) {
      // Merge with existing raw data if present
      const [existing] = await this.database.db
        .select({ raw: whatsappMessages.raw })
        .from(whatsappMessages)
        .where(eq(whatsappMessages.messageId, messageId))
        .limit(1);

      const existingRaw = (existing?.raw as any) || {};
      updateData.raw = {
        ...existingRaw,
        ...(metadata.pricing ? { pricing: metadata.pricing } : {}),
        ...(metadata.conversation ? { conversation: metadata.conversation } : {}),
        ...(metadata.errorCode ? { errorCode: metadata.errorCode } : {}),
        ...(metadata.cause ? { cause: metadata.cause } : {}),
        lastStatusUpdate: new Date().toISOString(),
      };
    }

    await this.database.db
      .update(whatsappMessages)
      .set(updateData)
      .where(eq(whatsappMessages.messageId, messageId));
  }

  // ─── Auto-Create Lead from WhatsApp ──────────────────────────────────────

  private async createLeadFromWhatsApp(phone: string, name: string, campaignId: string, transaction: AllocationTransaction) {
    // Get campaign details
    const [campaign] = await transaction
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign || !campaign.isActive) throw new Error('Auto-campaign not found');

    // Get first status in the campaign
    const [firstStatus] = await transaction
      .select()
      .from(campaignStatuses)
      .where(eq(campaignStatuses.campaignId, campaignId))
      .orderBy(asc(campaignStatuses.order))
      .limit(1);

    const leadName = (name || phone || 'Unknown').substring(0, 255);

    // Create lead and initial followup in a transaction
    const create = async (tx: AllocationTransaction) => {
      let doerId: string | undefined;
      try {
        doerId = await this.roundRobinService.getNextRoundRobinUser(campaignId, tx);
      } catch (error) {
        if (!(error instanceof BadRequestException)) throw error;
        // Leave unassigned when no active telecaller exists; do not assign an inactive manager.
      }
      const [lead] = await tx
        .insert(leads)
        .values({
          campaignId,
          name: leadName,
          phone,
          source: 'whatsapp',
          updatedAt: sql`clock_timestamp()`,
          doerId: doerId || null,
          statusId: firstStatus?.id,
        })
        .returning();

      // Create initial followup if we have a valid userId
      const followupUserId = doerId;
      if (followupUserId) {
        await tx.insert(followups).values({
          leadId: lead.id,
          userId: followupUserId,
          status: firstStatus?.label || 'New',
          remarks: 'Lead auto-created from WhatsApp inbound message',
        });
      }

      return [lead];
    };
    const [newLead] = await create(transaction);

    this.logger.log(`Auto-created lead ${newLead.id} from WhatsApp (${phone}) in campaign ${campaignId}`);
    return newLead;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private async sendToGupshup(cfg: { apiKey: string; source: string; appName: string }, dest: string, messageObj: any): Promise<GupshupMessageResponse> {
    if (!cfg.apiKey) throw new BadRequestException('Gupshup API key not configured');
    if (!cfg.source) throw new BadRequestException('Gupshup source number not configured');

    const params = new URLSearchParams();
    params.append('channel', 'whatsapp');
    params.append('source', this.normalizePhone(cfg.source));
    params.append('src.name', cfg.appName);
    params.append('destination', dest);
    params.append('message', JSON.stringify(messageObj));

    try {
      const response: AxiosResponse = await firstValueFrom(
        this.http.post(this.SESSION_MSG_URL, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', apikey: cfg.apiKey },
          timeout: 30000,
        }),
      );

      const body = response.data as any;
      this.logger.log(`Message sent to ${dest}: ${body.messageId}`);
      return {
        status: body.status || 'submitted',
        messageId: body.messageId || body.gsId || '',
      };
    } catch (error: any) {
      const status = error.response?.status || 'Unknown';
      const errBody = error.response?.data;
      this.logger.error(`Gupshup send error [${status}]: ${JSON.stringify(errBody || error.message)}`);
      throw new BadRequestException(`Failed to send WhatsApp message: ${errBody?.message || error.message}`);
    }
  }

  private async getContactName(phone: string): Promise<string> {
    try {
      const normalized = this.normalizePhone(phone);
      const [contact] = await this.database.db
        .select({ name: whatsappContacts.name })
        .from(whatsappContacts)
        .where(eq(whatsappContacts.phone, normalized))
        .limit(1);
      return contact?.name || '';
    } catch {
      return '';
    }
  }

  private async logMessage(
    phone: string,
    message: string,
    direction: string,
    type: string,
    mediaUrl: string | undefined,
    result: { status: string; messageId: string },
    opts?: { leadId?: string; campaignId?: string; userId?: string; name?: string },
  ) {
    try {
      await this.database.db.insert(whatsappMessages).values({
        phone: this.normalizePhone(phone),
        name: opts?.name || '',
        direction,
        message: (message || '').substring(0, 2000),
        type,
        mediaUrl,
        messageId: result.messageId,
        status: result.status,
        leadId: opts?.leadId,
        campaignId: opts?.campaignId,
        userId: opts?.userId,
      });
    } catch (error: any) {
      this.logger.error(`Failed to log WhatsApp message: ${error.message}`);
    }
  }

  private extractMediaUrl(message: any): string | undefined {
    if (!message || typeof message !== 'object') return undefined;
    const media = message.image || message.document || message.file || message.video || message.audio || message.sticker || message;
    const url = media.url || media.link || media.originalUrl || message.url || message.originalUrl;
    if (typeof url !== 'string' || url.length > 2000) return undefined;
    try { if (['http:', 'https:'].includes(new URL(url).protocol)) return url; } catch {}
    return undefined;
  }

  private extractText(message: any): string {
    if (!message) return '';
    const type = message.type || '';
    if (type === 'text') return message.text?.body || message.text || message.body || '';
    if (type === 'button') return message.button?.text || message.button?.payload || '';
    if (type === 'interactive') {
      if (message.interactive?.button_reply) return message.interactive.button_reply.title || '';
      if (message.interactive?.list_reply) return message.interactive.list_reply.title || '';
    }
    if (type === 'image') return message.image?.caption || message.caption || '[Image]';
    if (type === 'document' || type === 'file') return message.document?.caption || message.caption || message.document?.filename || message.filename || '[Document]';
    if (type === 'audio') return '[Audio]';
    if (type === 'video') return message.video?.caption || message.caption || '[Video]';
    if (type === 'location') return `[Location] ${message.location?.latitude || ''},${message.location?.longitude || ''}`;
    return message.text || message.caption || '';
  }

  private normalizePhone(phone: string): string {
    return normalizeWhatsAppPhone(phone);
  }
}
