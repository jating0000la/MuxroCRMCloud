import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './db/database.module';
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
import { NotificationsModule } from './notifications/notifications.module';
import { HealthController } from './health.controller';
import { AdminDashboardController } from './admin-dashboard.controller';

// New infrastructure modules
import { JobModule } from './jobs/job.module';
import { AuthorizationModule } from './common/authorization/authorization.module';
import { OutboxModule } from './common/outbox/outbox.module';
import { BackupModule } from './common/backup/backup.module';

// Middleware
import { StructuredLoggingMiddleware } from './common/logging/structured-logging.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
        blockDuration: 5000,
      },
    ]),
    DatabaseModule,
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
    NotificationsModule,
    // New infrastructure
    JobModule,
    AuthorizationModule,
    OutboxModule,
    BackupModule,
  ],
  controllers: [HealthController, AdminDashboardController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(StructuredLoggingMiddleware).forRoutes('*');
  }
}
