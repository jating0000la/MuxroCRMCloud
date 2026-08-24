import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { eq, and, desc, asc, like, sql, isNull, or } from 'drizzle-orm';
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

  async getChats(limit = 50, offset = 0) {
    // Get distinct phones with their last message, ordered by most recent chat at top
    const chats = await this.database.db.execute(sql`
      SELECT wm.phone,
        COALESCE(wm.name, wc.name, '') as name,
        wm.message as "lastMessage",
        wm."createdAt" as "lastMessageAt",
        wm.direction as "lastDirection",
        wm.type as "lastType",
        (SELECT COUNT(*) FROM "WhatsappMessage" wm2 WHERE wm2.phone = wm.phone AND direction = 'in' AND wm2.status IS NULL) as "unreadCount"
      FROM "WhatsappMessage" wm
      LEFT JOIN "WhatsappContact" wc ON wc.phone = wm.phone
      WHERE wm."createdAt" = (
        SELECT MAX(wm2."createdAt") FROM "WhatsappMessage" wm2 WHERE wm2.phone = wm.phone
      )
      ORDER BY wm."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return (chats.rows || []).map((row: any) => ({
      phone: row.phone,
      name: row.name || row.phone,
      lastMessage: row.lastMessage || '',
      lastMessageAt: row.lastMessageAt,
      lastDirection: row.lastDirection,
      lastType: row.lastType,
      unreadCount: Number(row.unreadCount) || 0,
    }));
  }

  async getChatMessages(phone: string, limit = 50, offset = 0) {
    const messages = await this.database.db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.phone, phone))
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(limit)
      .offset(offset);

    return messages.reverse(); // chronological order for display
  }

  async getChatStats() {
    const [total] = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappMessages);

    const [incoming] = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappMessages)
      .where(eq(whatsappMessages.direction, 'in'));

    const [outgoing] = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappMessages)
      .where(eq(whatsappMessages.direction, 'out'));

    const [uniqueChats] = await this.database.db
      .select({ count: sql<number>`count(DISTINCT phone)::int` })
      .from(whatsappMessages);

    return {
      totalMessages: total?.count || 0,
      incoming: incoming?.count || 0,
      outgoing: outgoing?.count || 0,
      uniqueChats: uniqueChats?.count || 0,
    };
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
    const cfg = await this.getConfig();
    const dest = this.normalizePhone(phone);

    const paramsArr = params || [];

    const url = this.TEMPLATE_MSG_URL;
    const formPayload: Record<string, string> = {
      source: cfg.source,
      destination: dest,
      'src.name': cfg.appName,
      template: JSON.stringify({ id: templateId, params: paramsArr }),
    };

    if (mediaType && mediaUrl) {
      const messageObj: any = { type: mediaType };
      messageObj[mediaType] = { link: mediaUrl };
      formPayload.message = JSON.stringify(messageObj);
    }

    try {
      const params_ = new URLSearchParams(formPayload);
      const response: AxiosResponse = await firstValueFrom(
        this.http.post(url, params_.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', apikey: cfg.apiKey },
          timeout: 30000,
        }),
      );

      const body = response.data as any;
      const result: GupshupMessageResponse = {
        status: body.status || 'submitted',
        messageId: body.messageId || '',
      };

      const name = await this.getContactName(dest);
      await this.logMessage(dest, `[Template] ${templateId}`, 'out', 'template', mediaUrl, result, { ...opts, name });
      return result;
    } catch (error: any) {
      const status = error.response?.status || 'Unknown';
      this.logger.error(`Template send failed [${status}]: ${error.message}`);
      throw new BadRequestException(`Failed to send template: ${error.message}`);
    }
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
    if (!phone) return { status: 'ignored' };

    // Find matching lead
    let leadId: string | undefined;
    let campaignId: string | undefined;
    try {
      const [lead] = await this.database.db
        .select()
        .from(leads)
        .where(and(eq(leads.phone, phone), eq(leads.isDeleted, false)))
        .orderBy(desc(leads.createdAt))
        .limit(1);
      if (lead) {
        leadId = lead.id;
        campaignId = lead.campaignId;
      }
    } catch {
      // No lead found — that's fine
    }

    // Auto-create lead if no existing lead and auto-campaign is configured
    if (!leadId) {
      try {
        const autoCampaignId = await this.settingsService
          .getSettingForUse('whatsappAutoCampaignId')
          .catch(() => '');
        if (autoCampaignId) {
          const newLead = await this.createLeadFromWhatsApp(phone, inbound.name, autoCampaignId);
          leadId = newLead.id;
          campaignId = newLead.campaignId;
        }
      } catch (error: any) {
        this.logger.error(`Failed to auto-create lead from WhatsApp: ${error.message}`);
      }
    }

    // Upsert contact
    await this.upsertContact(phone, inbound.name, leadId);

    // Log inbound message
    const text = typeof inbound.message === 'string'
      ? inbound.message
      : inbound.message?.text || inbound.message?.title || '';

    await this.logMessage(phone, text, 'in', inbound.msgType || 'text', undefined, {
      status: 'received',
      messageId: inbound.messageId,
    }, { leadId, campaignId, name: inbound.name });

    return { status: 'ok', messageId: inbound.messageId };
  }

  parseInboundPayload(payload: any): { source: string; name: string; message: any; msgType: string; messageId: string } | null {
    try {
      // Format 1: Gupshup native format { type: 'message', payload: { ... } }
      if (payload.type === 'message' && payload.payload) {
        const p = payload.payload;
        const innerPayload = p.payload || {};
        return {
          source: p.sender?.phone || p.source || p.phone || '',
          name: p.sender?.name || '',
          message: this.extractText(innerPayload),
          msgType: p.type || innerPayload.type || 'text',
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
          messageId: msg.id || '',
        };
      }

      // Format 3: Simple { user: { phone }, message: { text } }
      if (payload.user && payload.message) {
        return {
          source: payload.user.phone || payload.user.id || '',
          name: payload.user.name || '',
          message: payload.message.text || payload.message.caption || '',
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

  async getContacts(limit = 100, offset = 0) {
    return this.database.db
      .select()
      .from(whatsappContacts)
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

  async syncTemplates() {
    const cfg = await this.getConfig();
    if (!cfg.appId) throw new BadRequestException('Gupshup App ID required for template sync');

    const url = `https://api.gupshup.io/wa/app/${encodeURIComponent(cfg.appId)}/template?pageNo=0&pageSize=100`;

    try {
      const response: AxiosResponse = await firstValueFrom(
        this.http.get(url, {
          headers: { 'Content-Type': 'application/json', apikey: cfg.apiKey },
          timeout: 30000,
        }),
      );

      const body = response.data as any;
      const list = body.templates || body.data || body.payload || body.templateList || [];
      const templates = Array.isArray(list)
        ? list.map((t: any) => ({
            id: t.id || t.templateId || '',
            name: t.elementName || t.name || t.templateName || t.id || '',
            language: t.languageCode || t.language || '',
            category: t.category || t.templateCategory || '',
            type: t.templateType || t.type || '',
            status: t.status || t.templateStatus || '',
            body: t.data || t.body || t.content || '',
          }))
        : [];

      return { success: true, templates };
    } catch (error: any) {
      const status = error.response?.status;
      const body = error.response?.data;
      return { success: false, templates: [], error: `[${status}] ${body?.message || error.message}` };
    }
  }

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

  private async createLeadFromWhatsApp(phone: string, name: string, campaignId: string) {
    // Get campaign details
    const [campaign] = await this.database.db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) throw new Error('Auto-campaign not found');

    // Get first status in the campaign
    const [firstStatus] = await this.database.db
      .select()
      .from(campaignStatuses)
      .where(eq(campaignStatuses.campaignId, campaignId))
      .orderBy(asc(campaignStatuses.order))
      .limit(1);

    // Get round-robin user, fallback to campaign manager
    let doerId: string | undefined = campaign.managerId || undefined;
    try {
      doerId = await this.roundRobinService.getNextRoundRobinUser(campaignId);
    } catch {
      // Fallback to campaign manager if round-robin has no users
    }

    const leadName = (name || phone || 'Unknown').substring(0, 255);

    // Create lead and initial followup in a transaction
    const [newLead] = await this.database.db.transaction(async (tx) => {
      const [lead] = await tx
        .insert(leads)
        .values({
          campaignId,
          name: leadName,
          phone,
          source: 'whatsapp',
          doerId: doerId || null,
          statusId: firstStatus?.id,
        })
        .returning();

      // Create initial followup if we have a valid userId
      const followupUserId = doerId || campaign.managerId;
      if (followupUserId) {
        await tx.insert(followups).values({
          leadId: lead.id,
          userId: followupUserId,
          status: firstStatus?.label || 'New',
          remarks: 'Lead auto-created from WhatsApp inbound message',
        });
      }

      return [lead];
    });

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

  private extractText(message: any): string {
    if (!message) return '';
    const type = message.type || '';
    if (type === 'text') return message.text?.body || message.text || message.body || '';
    if (type === 'button') return message.button?.text || message.button?.payload || '';
    if (type === 'interactive') {
      if (message.interactive?.button_reply) return message.interactive.button_reply.title || '';
      if (message.interactive?.list_reply) return message.interactive.list_reply.title || '';
    }
    if (type === 'image') return message.caption || '[Image]';
    if (type === 'document') return message.document?.filename || '[Document]';
    if (type === 'audio') return '[Audio]';
    if (type === 'video') return message.caption || '[Video]';
    if (type === 'location') return `[Location] ${message.location?.latitude || ''},${message.location?.longitude || ''}`;
    return message.text || message.caption || '';
  }

  private normalizePhone(phone: string): string {
    return String(phone || '').replace(/\D/g, '');
  }
}
