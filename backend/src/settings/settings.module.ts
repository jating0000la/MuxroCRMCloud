import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { BrandingController } from './branding.controller';
import { SettingsController } from './settings.controller';
import { EncryptionService } from './encryption.service';
import { DatabaseModule } from '../db/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SettingsController, BrandingController],
  providers: [SettingsService, EncryptionService],
  exports: [SettingsService, EncryptionService],
})
export class SettingsModule {}
