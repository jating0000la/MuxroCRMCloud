import { NestFactory } from '@nestjs/core';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './db/database.module';
import { JobModule } from './jobs/job.module';
import { JobProcessors } from './jobs/job-processors.service';
import { IntegrationsModule } from './integrations/integrations.module';
import { BulkImportModule } from './bulk-import/bulk-import.module';
import { RoundRobinModule } from './common/common.module';
import { FollowupsModule } from './followups/followups.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OutboxModule } from './common/outbox/outbox.module';
import { BackupModule } from './common/backup/backup.module';
import { AuthModule } from './auth/auth.module';
import { SettingsModule } from './settings/settings.module';

const logger = new Logger('Worker');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    JobModule,
    IntegrationsModule,
    BulkImportModule,
    RoundRobinModule,
    FollowupsModule,
    NotificationsModule,
    OutboxModule,
    BackupModule,
    AuthModule,
    SettingsModule,
  ],
  providers: [JobProcessors],
})
class WorkerModule {}

async function bootstrap() {
  logger.log('Starting worker process...');

  const app = await NestFactory.createApplicationContext(WorkerModule);

  const processors = app.get(JobProcessors);
  await processors.registerAllProcessors();

  logger.log('Worker started and processing jobs');

  const shutdown = async () => {
    logger.log('Worker shutting down...');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Prevent silent worker death
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception: ${err.message}`, err.stack);
    // Don't exit - let worker continue processing other jobs
  });
  process.on('unhandledRejection', (reason: any) => {
    logger.error(`Unhandled Rejection: ${reason?.message || reason}`);
  });
}

bootstrap().catch((err) => {
  logger.error(`Worker failed to start: ${err.message}`);
  process.exit(1);
});
