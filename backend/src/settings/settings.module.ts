import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { EncryptionService } from './encryption.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SettingsController],
  providers: [SettingsService, EncryptionService],
  exports: [SettingsService, EncryptionService],
})
export class SettingsModule {}
