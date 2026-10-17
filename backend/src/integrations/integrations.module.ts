import { CloudConnectController, CloudConnectWebhookController } from './cloudconnect/cloudconnect.controller';
import { CloudConnectService } from './cloudconnect/cloudconnect.service';
import { RoundRobinModule } from '../common/common.module';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntegrationsController } from './integrations.controller';
import { GupshupController } from './gupshup.controller';
import { ProcessSutraService } from './process-sutra.service';
import { IndiamartService } from './indiamart.service';
import { GupshupService } from './gupshup.service';
import { DatabaseModule } from '../db/database.module';
import { SettingsModule } from '../settings/settings.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [HttpModule, DatabaseModule, SettingsModule, WhatsAppModule, RoundRobinModule],
  controllers: [IntegrationsController, GupshupController, CloudConnectController, CloudConnectWebhookController],
  providers: [ProcessSutraService, IndiamartService, GupshupService, CloudConnectService],
  exports: [ProcessSutraService, IndiamartService, GupshupService, CloudConnectService],
})
export class IntegrationsModule {}
