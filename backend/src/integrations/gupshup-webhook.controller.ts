import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { GupshupService } from './gupshup.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Gupshup WhatsApp Webhook')
@Controller('integrations/gupshup')
export class GupshupWebhookController {
  private readonly logger = new Logger(GupshupWebhookController.name);

  constructor(
    private gupshup: GupshupService,
    private prisma: PrismaService,
  ) {}

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive inbound WhatsApp messages from Gupshup (no auth)' })
  async handleWebhook(@Body() payload: any) {
    this.logger.log('Received Gupshup webhook');

    const message = this.gupshup.parseInboundWebhook(payload);
    if (!message) {
      this.logger.warn('Failed to parse Gupshup webhook payload');
      return { status: 'ok' };
    }

    const senderPhone = message.source;
    if (!senderPhone) {
      this.logger.warn('No source phone in webhook payload');
      return { status: 'ok' };
    }

    try {
      const lead = await this.prisma.lead.findFirst({
        where: { phone: senderPhone },
        orderBy: { createdAt: 'desc' },
      });

      if (!lead) {
        this.logger.log(`No lead found for phone ${senderPhone}, ignoring`);
        return { status: 'ok' };
      }

      const textContent = typeof message.message === 'string'
        ? message.message
        : message.message?.text || '';

      await this.prisma.followup.create({
        data: {
          leadId: lead.id,
          userId: lead.doerId || 'system',
          status: 'WhatsApp Received',
          remarks: `Inbound WhatsApp: ${textContent.substring(0, 500)}`,
        },
      });

      this.logger.log(`Created followup for lead ${lead.id} from inbound WhatsApp`);
    } catch (error: any) {
      this.logger.error(`Webhook processing error: ${error.message}`);
    }

    return { status: 'ok' };
  }
}
