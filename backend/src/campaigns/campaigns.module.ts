import { GupshupTemplatesModule } from '../integrations/templates/gupshup-templates.module';
import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignStatusesService } from './campaign-statuses.service';
import { CampaignStatusesController } from './campaign-statuses.controller';

@Module({
  imports: [GupshupTemplatesModule],
  controllers: [CampaignsController, CampaignStatusesController],
  providers: [CampaignsService, CampaignStatusesService],
  exports: [CampaignsService, CampaignStatusesService],
})
export class CampaignsModule {}
