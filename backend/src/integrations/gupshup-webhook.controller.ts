import { Controller, Post, Body, HttpCode, HttpStatus, Logger, Req, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { DatabaseService } from '../db/database.service';
import { SettingsService } from '../settings/settings.service';
import { followups, leads, campaigns } from '../db/schema';
import { eq, and, desc, like } from 'drizzle-orm';

@ApiTags('Gupshup Webhook')
@Controller('integrations/gupshup')
export class GupshupWebhookController {
  private readonly logger = new Logger(GupshupWebhookController.name);

  constructor(
    private whatsapp: WhatsAppService,
    private database: DatabaseService,
    private settingsService: SettingsService,
  ) {}

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive inbound WhatsApp messages from Gupshup' })
  async handleWebhook(@Body() payload: any, @Req() request: Request) {
    this.logger.log('Received Gupshup webhook');
    await this.assertWebhookSecret(request.header('x-gupshup-webhook-secret') || undefined);

    const result = await this.whatsapp.processInbound(payload);
    if (result.status === 'ok' && result.messageId) {
      try {
        await this.createFollowupFromInbound(payload, result.messageId);
      } catch (err: any) {
        this.logger.error(`Followup creation failed: ${err.message}`);
      }
    }

    return { status: 'ok' };
  }

  @Post('webhook/status')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive delivery status updates from Gupshup' })
  async handleStatusWebhook(@Body() payload: any, @Req() request: Request) {
    this.logger.log('Received Gupshup status webhook');
    await this.assertWebhookSecret(request.header('x-gupshup-webhook-secret') || undefined);

    try {
      const eventType = payload.type || payload.event || '';
      const eventPayload = payload.payload || payload;

      if (eventType === 'message-event' || eventPayload.type) {
        const gsId = eventPayload.id || eventPayload.gsId || eventPayload.messageId || eventPayload.externalId || '';
        const rawStatus = eventPayload.type || eventPayload.status || eventPayload.eventType || '';
        const mappedStatus = this.mapGupshupStatus(rawStatus);

        const pricing = eventPayload.pricing || payload.pricing || null;
        const conversation = eventPayload.conversation || payload.conversation || null;
        const errorCode = eventPayload.errorCode || eventPayload.error_code || null;
        const cause = eventPayload.cause || null;

        if (gsId) {
          await this.whatsapp.updateMessageStatus(gsId, mappedStatus, {
            pricing: pricing ? {
              category: pricing.category || pricing.model || '',
              billable: pricing.billable,
              pricingType: pricing.pricing_type || pricing.type || '',
            } : undefined,
            conversation: conversation ? {
              id: conversation.id || '',
              expirationTimestamp: conversation.expiration_timestamp || null,
              originType: conversation.origin?.type || '',
            } : undefined,
            errorCode: errorCode || undefined,
            cause: cause || undefined,
          });
          this.logger.log(`Message ${gsId} status updated to ${mappedStatus}${pricing ? ` (pricing: ${pricing.category})` : ''}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Status webhook error: ${err.message}`);
    }

    return { status: 'ok' };
  }

  private async createFollowupFromInbound(payload: any, messageId: string) {
    const inbound = this.whatsapp.parseInboundPayload(payload);
    if (!inbound) return;

    const phone = String(inbound.source).replace(/\D/g, '');
    if (!phone) return;

    const [existing] = await this.database.db
      .select()
      .from(followups)
      .where(like(followups.remarks, `%[msg:${messageId}]%`))
      .limit(1);
    if (existing) return;

    const [lead] = await this.database.db
      .select({ lead: leads, campaign: { managerId: campaigns.managerId } })
      .from(leads)
      .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
      .where(and(eq(leads.phone, phone), eq(leads.isDeleted, false)))
      .orderBy(desc(leads.createdAt))
      .limit(1);

    if (!lead) return;

    const text = typeof inbound.message === 'string'
      ? inbound.message
      : inbound.message?.text || '';

    const userId = lead.lead.doerId || lead.campaign?.managerId;
    if (!userId) return;

    const senderName = inbound.name || '';
    const namePrefix = senderName ? `[${senderName}] ` : '';

    await this.database.db.insert(followups).values({
      leadId: lead.lead.id,
      userId,
      status: 'WhatsApp Received',
      remarks: `[msg:${messageId}] ${namePrefix}Inbound WhatsApp: ${text.substring(0, 500)}`,
    });

    this.logger.log(`Created followup for lead ${lead.lead.id} from inbound WhatsApp`);
  }

  private mapGupshupStatus(status: string): string {
    const s = String(status).toLowerCase();
    if (s === 'sent') return 'sent';
    if (s === 'delivered') return 'delivered';
    if (s === 'read') return 'read';
    if (s === 'failed' || s === 'undelivered') return 'failed';
    if (s === 'submitted') return 'submitted';
    return s;
  }

  private async assertWebhookSecret(headerToken: string | undefined): Promise<void> {
    let configuredSecret = '';
    try {
      configuredSecret = (await this.settingsService.getSettingForUse('gupshupWebhookSecret')).trim();
    } catch {
      this.logger.warn('Webhook secret not configured — rejecting webhook');
      throw new UnauthorizedException('Webhook secret not configured');
    }

    if (!configuredSecret) {
      this.logger.warn('Webhook secret is empty — rejecting webhook');
      throw new UnauthorizedException('Webhook secret not configured');
    }

    if (!headerToken) {
      throw new UnauthorizedException('Missing webhook secret header');
    }

    const a = Buffer.from(configuredSecret);
    const b = Buffer.from(headerToken.trim());
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      this.logger.warn('Rejected Gupshup webhook with invalid secret');
      throw new UnauthorizedException('Invalid webhook token');
    }
  }
}
