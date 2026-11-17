import { GupshupTemplatesModule } from './templates/gupshup-templates.module';
import { CloudConnectController, CloudConnectWebhookController } from './cloudconnect/cloudconnect.controller';
import { CloudConnectService } from './cloudconnect/cloudconnect.service';
import { RoundRobinModule } from '../common/common.module';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntegrationsController } from './integrations.controller';
import { GupshupController } from './gupshup.controller';
import { ProcessSutraService } from './process-sutra.service';
import { IndiamartService } from './indiamart.service';
import { DatabaseModule } from '../db/database.module';
import { SettingsModule } from '../settings/settings.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [HttpModule, DatabaseModule, SettingsModule, WhatsAppModule, RoundRobinModule, GupshupTemplatesModule],
  controllers: [IntegrationsController, GupshupController, CloudConnectController, CloudConnectWebhookController],
  providers: [ProcessSutraService, IndiamartService, CloudConnectService],
  exports: [ProcessSutraService, IndiamartService, GupshupTemplatesModule, CloudConnectService],
})
export class IntegrationsModule {}
