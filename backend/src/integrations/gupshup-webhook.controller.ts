import { Controller, Post, Body, HttpCode, HttpStatus, Logger, Query, Req, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { GupshupService } from './gupshup.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

@ApiTags('Gupshup WhatsApp Webhook')
@Controller('integrations/gupshup')
export class GupshupWebhookController {
  private readonly logger = new Logger(GupshupWebhookController.name);

  constructor(
    private gupshup: GupshupService,
    private prisma: PrismaService,
    private settingsService: SettingsService,
  ) {}

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive inbound WhatsApp messages from Gupshup (no auth)' })
  async handleWebhook(
    @Body() payload: any,
    @Query('token') token: string | undefined,
    @Req() request: Request,
  ) {
    this.logger.log('Received Gupshup webhook');

    await this.assertWebhookSecret(token, request.header('x-gupshup-webhook-secret') || undefined);

    const message = this.gupshup.parseInboundWebhook(payload);
    if (!message) {
      this.logger.warn('Failed to parse Gupshup webhook payload');
      return { status: 'ok' };
    }

    if (message.type !== 'message') {
      this.logger.log(`Ignoring non-message Gupshup event: ${message.type}`);
      return { status: 'ignored' };
    }

    const senderPhone = message.source;
    if (!senderPhone) {
      this.logger.warn('No source phone in webhook payload');
      return { status: 'ok' };
    }

    // Idempotency: skip if messageId already processed
    const messageId = message.messageId;
    if (messageId) {
      const existing = await this.prisma.followup.findFirst({
        where: { remarks: { contains: `[msg:${messageId}]` } },
      });
      if (existing) {
        this.logger.log(`Duplicate webhook ignored (messageId: ${messageId})`);
        return { status: 'ok' };
      }
    }

    try {
      const lead = await this.prisma.lead.findFirst({
        where: { phone: senderPhone },
        include: {
          campaign: {
            select: { managerId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!lead) {
        this.logger.log(`No lead found for phone ${senderPhone}, ignoring`);
        return { status: 'ok' };
      }

      const textContent = typeof message.message === 'string'
        ? message.message
        : message.message?.text || message.message?.title || message.message?.caption || '';

      const followupUserId = lead.doerId || lead.campaign?.managerId;
      if (!followupUserId) {
        this.logger.warn(`Skipping inbound WhatsApp followup for lead ${lead.id}: no assigned user or campaign manager`);
        return { status: 'ignored' };
      }

      const remarks = `[msg:${messageId || 'unknown'}] Inbound WhatsApp: ${textContent.substring(0, 500)}`;

      await this.prisma.followup.create({
        data: {
          leadId: lead.id,
          userId: followupUserId,
          status: 'WhatsApp Received',
          remarks,
        },
      });

      this.logger.log(`Created followup for lead ${lead.id} from inbound WhatsApp`);
    } catch (error: any) {
      this.logger.error(`Webhook processing error: ${error.message}`);
    }

    return { status: 'ok' };
  }

  private async assertWebhookSecret(
    queryToken: string | undefined,
    headerToken: string | undefined,
  ): Promise<void> {
    let configuredSecret = '';

    try {
      configuredSecret = (await this.settingsService.getSettingForUse('gupshupWebhookSecret')).trim();
    } catch {
      this.logger.warn('Webhook secret setting not configured — rejecting webhook. Set gupshupWebhookSecret in Settings.');
      throw new UnauthorizedException('Webhook secret not configured');
    }

    if (!configuredSecret) {
      this.logger.warn('Webhook secret is empty — rejecting webhook');
      throw new UnauthorizedException('Webhook secret not configured');
    }

    const providedSecret = (queryToken || headerToken || '').trim();
    if (providedSecret !== configuredSecret) {
      this.logger.warn('Rejected Gupshup webhook with invalid secret');
      throw new UnauthorizedException('Invalid webhook token');
    }
  }
}
