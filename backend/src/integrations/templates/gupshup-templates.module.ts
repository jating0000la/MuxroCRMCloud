import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from '../../db/database.module';
import { SettingsModule } from '../../settings/settings.module';
import { GupshupService } from '../gupshup.service';
import { GupshupTemplatesService } from './gupshup-templates.service';
import { GupshupTemplatesController } from './gupshup-templates.controller';
@Module({ imports: [HttpModule, DatabaseModule, SettingsModule], controllers: [GupshupTemplatesController],
  providers: [GupshupService, GupshupTemplatesService], exports: [GupshupService, GupshupTemplatesService] })
export class GupshupTemplatesModule {}
