import { Controller, Post, Body, HttpCode, HttpStatus, Logger, Req } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { WhatsAppService } from './whatsapp.service';
import { DatabaseService } from '../db/database.service';
import { SettingsService } from '../settings/settings.service';
import { followups, leads, campaigns } from '../db/schema';
import { eq, and, desc, like } from 'drizzle-orm';

@ApiTags('WhatsApp Webhook')
@Controller('whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private whatsapp: WhatsAppService,
    private database: DatabaseService,
    private settingsService: SettingsService,
  ) {}

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive inbound WhatsApp messages (no auth — called by Gupshup)' })
  async handleWebhook(@Body() payload: any, @Req() request: Request) {
    this.logger.log('Received WhatsApp webhook');

    // Verify webhook secret
    await this.assertWebhookSecret(request.header('x-gupshup-webhook-secret') || undefined);

    // Process inbound message and store in DB
    const result = await this.whatsapp.processInbound(payload);

    if (result.status === 'ok' && result.messageId) {
      // Also create a followup record (backward-compatible with existing CRM flow)
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
  async handleStatusWebhook(@Body() payload: any) {
    this.logger.log('Received WhatsApp status webhook');

    try {
      const eventType = payload.type || payload.event || '';
      const eventPayload = payload.payload || payload;

      if (eventType === 'message-event' || eventPayload.type) {
        const gsId = eventPayload.id || eventPayload.gsId || eventPayload.messageId || '';
        const status = eventPayload.type || eventPayload.status || '';

        if (gsId) {
          const mappedStatus = this.mapGupshupStatus(status);
          await this.whatsapp.updateMessageStatus(gsId, mappedStatus);
          this.logger.log(`Message ${gsId} status updated to ${mappedStatus}`);
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

    // Idempotency check
    const [existing] = await this.database.db
      .select()
      .from(followups)
      .where(like(followups.remarks, `%[msg:${messageId}]%`))
      .limit(1);
    if (existing) return;

    // Find matching lead
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

    await this.database.db.insert(followups).values({
      leadId: lead.lead.id,
      userId,
      status: 'WhatsApp Received',
      remarks: `[msg:${messageId}] Inbound WhatsApp: ${text.substring(0, 500)}`,
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
      throw new Error('Webhook secret not configured');
    }

    if (!configuredSecret || !headerToken) {
      throw new Error('Missing webhook secret');
    }

    const a = Buffer.from(configuredSecret);
    const b = Buffer.from(headerToken);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Invalid webhook secret');
    }
  }
}
