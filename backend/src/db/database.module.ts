import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabaseMonitoringService } from './database-monitoring.service';

@Global()
@Module({
  providers: [DatabaseService, DatabaseMonitoringService],
  exports: [DatabaseService, DatabaseMonitoringService],
})
export class DatabaseModule {}
