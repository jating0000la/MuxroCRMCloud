import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { FormsModule } from './forms/forms.module';
import { LeadsModule } from './leads/leads.module';
import { FollowupsModule } from './followups/followups.module';
import { BulkImportModule } from './bulk-import/bulk-import.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { SettingsModule } from './settings/settings.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // ✅ FIXED: Reduced rate limits and added endpoint-specific throttling
    // Default: 100 requests per minute
    // Auth endpoints will override with stricter limits
    ThrottlerModule.forRoot([
      {
        ttl: 60000,        // 1 minute
        limit: 100,        // 100 requests per minute (default)
        blockDuration: 5000,  // Block for 5 seconds after limit exceeded
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    CampaignsModule,
    FormsModule,
    LeadsModule,
    FollowupsModule,
    BulkImportModule,
    DashboardModule,
    IntegrationsModule,
    SettingsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
