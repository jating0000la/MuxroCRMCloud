import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WebhookTokenGuard } from './webhook-token.guard';
import { SettingsService } from '../settings/settings.service';
import { DatabaseService } from '../db/database.service';
import { whatsappMessages } from '../db/schema';
import { desc, eq } from 'drizzle-orm';

@Controller('whatsapp/webhook-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WebhookConfigController {
  constructor(private guard: WebhookTokenGuard, private settings: SettingsService, private database: DatabaseService) {}
  @Get() async get() {
    const [last] = await this.database.db.select({ receivedAt: whatsappMessages.createdAt }).from(whatsappMessages)
      .where(eq(whatsappMessages.direction, 'in')).orderBy(desc(whatsappMessages.createdAt)).limit(1);
    return { configured: Boolean(await this.guard.configuredToken()), lastReceivedAt: last?.receivedAt || null };
  }
  @Post('token') async rotate(@Req() req: any) {
    const token = randomBytes(32).toString('hex');
    await this.settings.createSetting({ key: 'gupshupWebhookToken', value: token, reason: 'Configure incoming WhatsApp callback authentication' }, req.user.id);
    return { token };
  }
}
