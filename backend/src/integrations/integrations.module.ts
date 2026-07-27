import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntegrationsController } from './integrations.controller';
import { GupshupController } from './gupshup.controller';
import { GupshupWebhookController } from './gupshup-webhook.controller';
import { ProcessSutraService } from './process-sutra.service';
import { IndiamartService } from './indiamart.service';
import { GupshupService } from './gupshup.service';
import { DatabaseModule } from '../db/database.module';
import { SettingsModule } from '../settings/settings.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [HttpModule, DatabaseModule, SettingsModule, WhatsAppModule],
  controllers: [IntegrationsController, GupshupController, GupshupWebhookController],
  providers: [ProcessSutraService, IndiamartService, GupshupService],
  exports: [ProcessSutraService, IndiamartService, GupshupService],
})
export class IntegrationsModule {}
