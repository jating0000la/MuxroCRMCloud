import { Controller, Post, Body, HttpCode, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { WebhookTokenGuard } from './webhook-token.guard';
import { WhatsAppService } from './whatsapp.service';

@ApiTags('WhatsApp Webhook')
@UseGuards(WebhookTokenGuard)
@Controller(['whatsapp', 'integrations/gupshup'])
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private whatsapp: WhatsAppService,
  ) {}

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive token-authenticated inbound WhatsApp messages' })
  async handleWebhook(@Body() payload: any) {
    this.logger.log('Received WhatsApp webhook');

    // Gupshup posts incoming messages AND delivery events to its configured callback.
    if (payload?.type === 'message-event' || payload?.eventType) return this.handleStatusWebhook(payload);
    await this.whatsapp.processInbound(payload);

    return { status: 'ok' };
  }

  @Post('webhook/status')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive delivery status updates from Gupshup' })
  async handleStatusWebhook(@Body() payload: any) {
    this.logger.log('Received WhatsApp status webhook');

    try {
      // Gupshup delivery event format per docs:
      // { type: 'message-event', payload: { type: 'SENT'|'DELIVERED'|'READ'|'FAILED', id, srcAddr, destAddr, cause, errorCode, conversation, pricing } }
      // Alternate format: top-level { externalId, eventType, srcAddr, destAddr, cause, errorCode, conversation, pricing }
      const eventType = payload.type || payload.event || '';
      const eventPayload = payload.payload || payload;

      if (eventType === 'message-event' || eventPayload.type || eventPayload.eventType) {
        const gsId = eventPayload.id || eventPayload.gsId || eventPayload.messageId || eventPayload.externalId || '';
        const rawStatus = eventPayload.type || eventPayload.status || eventPayload.eventType || '';
        const mappedStatus = this.mapGupshupStatus(rawStatus);

        // Extract pricing and conversation metadata per docs
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

  private mapGupshupStatus(status: string): string {
    const s = String(status).toLowerCase();
    if (s === 'sent') return 'sent';
    if (s === 'delivered') return 'delivered';
    if (s === 'read') return 'read';
    if (s === 'failed' || s === 'undelivered') return 'failed';
    if (s === 'submitted') return 'submitted';
    return s;
  }

}
