import { Module } from '@nestjs/common';
import { FormsService } from './forms.service';
import { FormsController } from './forms.controller';
import { PublicFormsController } from './public-forms.controller';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [IntegrationsModule, SettingsModule],
  controllers: [FormsController, PublicFormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
