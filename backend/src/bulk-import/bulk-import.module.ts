import { Module } from '@nestjs/common';
import { BulkImportService } from './bulk-import.service';
import { BulkImportController } from './bulk-import.controller';

@Module({
  controllers: [BulkImportController],
  providers: [BulkImportService],
  exports: [BulkImportService],
})
export class BulkImportModule {}
