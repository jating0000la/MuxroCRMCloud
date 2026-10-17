import { WebhookConfigController } from './webhook-config.controller';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WebhookTokenGuard } from './webhook-token.guard';
import { WhatsAppService } from './whatsapp.service';
import { DatabaseModule } from '../db/database.module';
import { SettingsModule } from '../settings/settings.module';
import { RoundRobinModule } from '../common/common.module';

@Module({
  imports: [HttpModule, DatabaseModule, SettingsModule, RoundRobinModule],
  controllers: [WhatsAppController, WhatsAppWebhookController, WebhookConfigController],
  providers: [WhatsAppService, WebhookTokenGuard],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
