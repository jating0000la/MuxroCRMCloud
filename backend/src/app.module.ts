import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
})
export class AppModule {}
