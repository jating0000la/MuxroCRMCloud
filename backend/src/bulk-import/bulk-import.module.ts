import { Module } from '@nestjs/common';
import { BulkImportService } from './bulk-import.service';
import { BulkImportController } from './bulk-import.controller';
import { RoundRobinModule } from '../common/common.module';

@Module({
  imports: [RoundRobinModule],
  controllers: [BulkImportController],
  providers: [BulkImportService],
  exports: [BulkImportService],
})
export class BulkImportModule {}
