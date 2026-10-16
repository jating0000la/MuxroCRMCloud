import {
  Controller, Post, Param, Body, UseGuards, UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { BulkImportService } from './bulk-import.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { ImportLeadsDto, ImportOptionsDto } from './dto/import-leads.dto';

@ApiTags('Bulk Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('campaigns/:campaignId/bulk-import')
export class BulkImportController {
  constructor(private bulkImportService: BulkImportService) {}

  @Post('csv')
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Import leads from CSV file (max 50MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        allocateRoundRobin: { type: 'boolean', default: true },
      },
    },
  })
  async importCSV(
    @Param('campaignId') campaignId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() options: ImportOptionsDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const shouldAllocate = options.allocateRoundRobin !== false;
    return this.bulkImportService.importFromCSV(campaignId, file.buffer, shouldAllocate);
  }

  @Post('json')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Import leads from JSON data' })
  async importJSON(
    @Param('campaignId') campaignId: string,
    @Body() body: ImportLeadsDto,
  ) {
    return this.bulkImportService.importFromJSON(
      campaignId,
      body.data,
      body.allocateRoundRobin !== false,
    );
  }
}
