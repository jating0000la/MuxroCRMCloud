import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntegrationsController } from './integrations.controller';
import { GupshupController } from './gupshup.controller';
import { ProcessSutraService } from './process-sutra.service';
import { IndiamartService } from './indiamart.service';
import { GupshupService } from './gupshup.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [HttpModule, PrismaModule],
  controllers: [IntegrationsController, GupshupController],
  providers: [ProcessSutraService, IndiamartService, GupshupService],
  exports: [ProcessSutraService, IndiamartService, GupshupService],
})
export class IntegrationsModule {}
