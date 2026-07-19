import {
  Controller,
  Get,
  Delete,
  Res,
  UseGuards,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DataExportService } from './data-export.service';

@ApiTags('Data Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/data-export')
export class DataExportController {
  constructor(private readonly dataExportService: DataExportService) {}

  @Get('download')
  @ApiOperation({ summary: 'Download all campaign data as ZIP with CSV files' })
  @Header('Content-Type', 'application/zip')
  async downloadAllData(@Res() res: Response) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `campaign_data_export_${timestamp}.zip`;

      const { stream } = await this.dataExportService.generateExportZip();

      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });

      stream.pipe(res);

      stream.on('error', (err) => {
        console.error('Export stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Export failed' });
        }
      });
    } catch (error: any) {
      console.error('Export error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: error.message || 'Export failed' });
      }
    }
  }

  @Delete('all')
  @ApiOperation({ summary: 'Delete ALL campaign data (campaigns, leads, forms, followups)' })
  async deleteAllData() {
    return this.dataExportService.deleteAllCampaignData();
  }
}
