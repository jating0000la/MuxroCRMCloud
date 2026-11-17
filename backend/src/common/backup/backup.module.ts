import { Module, Global } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupMaintenanceService } from './backup-maintenance.service';

@Global()
@Module({
  providers: [BackupService, BackupMaintenanceService],
  exports: [BackupService, BackupMaintenanceService],
})
export class BackupModule {}
