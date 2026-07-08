import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntegrationsController } from './integrations.controller';
import { ProcessSutraService } from './process-sutra.service';
import { IndiamartService } from './indiamart.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [HttpModule, PrismaModule],
  controllers: [IntegrationsController],
  providers: [ProcessSutraService, IndiamartService],
  exports: [ProcessSutraService, IndiamartService],
})
export class IntegrationsModule {}
