import { BadRequestException, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import { SettingsService } from '../../settings/settings.service';
import { GupshupService } from '../gupshup.service';
import { gupshupTemplates, leads, whatsappMessages } from '../../db/schema';
import { ApprovedTemplate, TemplateMessageConfig, resolveTemplateValue } from './template.types';
import { normalizeWhatsAppPhone } from '../../whatsapp/phone';

type Reader = Pick<DatabaseService['db'], 'select'>;
@Injectable()
export class GupshupTemplatesService {
  constructor(private database: DatabaseService, private settings: SettingsService, private gupshup: GupshupService) {}

  async appId() { return (await this.settings.getSettingForUse('gupshupAppId')).trim(); }
  async list() {
    const appId = await this.appId();
    const rows = await this.database.db.select().from(gupshupTemplates).where(eq(gupshupTemplates.appId, appId));
    return { templates: rows.map(r => r.content), syncedAt: rows[0]?.syncedAt || null };
  }
  async sync() {
    const appId = await this.appId();
    const result = await this.gupshup.syncTemplates(await this.settings.getSettingForUse('gupshupApiKey'), appId);
    if (!result.success) return result;
    await this.database.db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'gupshup-template-sync:' + appId}))`);
      await tx.delete(gupshupTemplates).where(eq(gupshupTemplates.appId, appId));
      for (let start = 0; start < result.templates.length; start += 100) {
        await tx.insert(gupshupTemplates).values(result.templates.slice(start, start + 100).map(t => ({ appId, templateId: t.id, content: t })));
      }
    });
    return result;
  }
  async approved(templateId: string, db: Reader = this.database.db, appId?: string): Promise<ApprovedTemplate> {
    const configuredApp = appId ?? await this.appId();
    const [row] = await db.select().from(gupshupTemplates).where(and(eq(gupshupTemplates.appId, configuredApp), eq(gupshupTemplates.templateId, templateId))).limit(1);
    if (!row || row.content.status !== 'APPROVED') throw new BadRequestException('Select an approved Gupshup template. Sync templates in Communication Setup first.');
    if (!row.content.supported) throw new BadRequestException(row.content.unsupportedReason || 'Unsupported template');
    return row.content;
  }
  async validateConfig(value: unknown, fields?: string[]): Promise<TemplateMessageConfig> {
    const config = value as TemplateMessageConfig;
    if (!config || typeof config.templateId !== 'string' || !config.templateId || config.templateId.length > 255 ||
        !Array.isArray(config.params) || config.params.some(p => typeof p !== 'string' || p.length > 1024) || config.params.length > 50 ||
        (config.mediaUrl !== undefined && (typeof config.mediaUrl !== 'string' || config.mediaUrl.length > 2000)) ||
        (config.recipientField !== undefined && (typeof config.recipientField !== 'string' || config.recipientField.length > 255))) {
      throw new BadRequestException('Invalid WhatsApp template configuration');
    }
    const template = await this.approved(config.templateId);
    if (config.params.length !== template.parameterCount || config.params.some(p => !p.trim())) throw new BadRequestException(`Map all ${template.parameterCount} template variables in order`);
    if (fields) {
      for (const pattern of [...config.params, config.mediaUrl || '']) {
        for (const match of pattern.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) if (!fields.includes(match[1])) throw new BadRequestException(`Unknown form field: ${match[1]}`);
      }
      if (config.recipientField && !fields.includes(config.recipientField)) throw new BadRequestException('Choose a phone field present in this form');
    }
    if (template.headerType !== 'text' && !config.mediaUrl && !template.mediaUrl) throw new BadRequestException('This template requires a public media URL');
    const media = config.mediaUrl || template.mediaUrl;
    if (template.headerType !== 'text' && media && !media.includes('{{')) this.publicUrl(media);
    return { templateId: config.templateId, params: config.params, ...(config.mediaUrl ? { mediaUrl: config.mediaUrl } : {}), ...(config.recipientField ? { recipientField: config.recipientField } : {}) };
  }
  resolve(config: TemplateMessageConfig, values: Record<string, any>) {
    return { templateId: config.templateId, params: config.params.map(p => resolveTemplateValue(p, values)),
      ...(config.mediaUrl ? { mediaUrl: resolveTemplateValue(config.mediaUrl, values) } : {}) };
  }
  private publicUrl(url: string) {
    try { if (['http:', 'https:'].includes(new URL(url).protocol) && url.length <= 2000) return url; } catch {}
    throw new BadRequestException('Template media must be a public HTTP or HTTPS URL');
  }
  async send(phone: string, templateId: string, params: string[], mediaUrl?: string,
    opts: { leadId?: string; campaignId?: string; userId?: string; automationKey?: string } = {}) {
    const template = await this.approved(templateId);
    if (!Array.isArray(params) || params.length !== template.parameterCount || params.some(p => typeof p !== 'string' || p.length > 1024 || !p.trim())) {
      throw new BadRequestException(`Provide ${template.parameterCount} non-empty template parameter values`);
    }
    const media = template.headerType === 'text' ? undefined : this.publicUrl(mediaUrl || template.mediaUrl);
    const phoneNumber = normalizeWhatsAppPhone(phone);
    const [apiKey, source, appName] = await Promise.all(['gupshupApiKey', 'gupshupSource', 'gupshupAppName'].map(key => this.settings.getSettingForUse(key)));
    return this.database.db.transaction(async tx => {
      const maintenance = await tx.execute(sql`SELECT pg_try_advisory_xact_lock_shared(1465078355) AS acquired`);
      if (!maintenance.rows[0]?.acquired) throw new BadRequestException('Database maintenance is running. Retry this message later.');
      if (opts.automationKey) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${opts.automationKey}))`);
        const [existing] = await tx.select().from(whatsappMessages).where(eq(whatsappMessages.automationKey, opts.automationKey)).limit(1);
        if (existing) return { status: existing.status || 'submitted', messageId: existing.messageId || '', duplicate: true };
      }
      let owner = opts.userId;
      if (opts.leadId) {
        const [lead] = await tx.select().from(leads).where(and(eq(leads.id, opts.leadId), eq(leads.isDeleted, false), eq(leads.dnd, false))).limit(1).for('share');
        if (!lead) throw new BadRequestException('This lead is deleted or marked DND');
        if (opts.campaignId && lead.campaignId !== opts.campaignId) throw new BadRequestException('Lead moved to another campaign; this queued message was cancelled');
        if (normalizeWhatsAppPhone(lead.phone) !== phoneNumber) throw new BadRequestException('Recipient no longer matches the lead phone');
        owner = lead.doerId || owner;
      }
      const result = await this.gupshup.sendTemplateMessage(apiKey, source, appName, phoneNumber, templateId, params,
        media ? { type: template.headerType, link: media } : undefined);
      const text = template.body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, index) => params[Number(index) - 1] || '');
      await tx.insert(whatsappMessages).values({ phone: phoneNumber, direction: 'out', type: 'template',
        message: text || `[Template] ${template.name}`, mediaUrl: media, status: result.status, messageId: result.messageId,
        leadId: opts.leadId, campaignId: opts.campaignId, userId: owner, automationKey: opts.automationKey,
        raw: { templateId, templateName: template.name, params, templateMediaType: template.headerType, templateButtons: template.buttons } });
      return result;
    });
  }
}
