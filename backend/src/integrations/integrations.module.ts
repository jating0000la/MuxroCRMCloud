import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntegrationsController } from './integrations.controller';
import { ProcessSutraService } from './process-sutra.service';
import { IndiamartService } from './indiamart.service';

@Module({
  imports: [HttpModule],
  controllers: [IntegrationsController],
  providers: [ProcessSutraService, IndiamartService],
  exports: [ProcessSutraService, IndiamartService],
})
export class IntegrationsModule {}
