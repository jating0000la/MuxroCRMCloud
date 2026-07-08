import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus, Logger, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProcessSutraService } from './process-sutra.service';
import { IndiamartService } from './indiamart.service';
import { StartFlowDto, FetchIndiamartDto, AutoImportIndiamartDto } from './dto/integration.dto';

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations')
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  constructor(
    private processSutra: ProcessSutraService,
    private indiamart: IndiamartService,
  ) {}

  @Post('process-sutra/start-flow')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a Process Sutra flow' })
  @ApiResponse({ status: 200, description: 'Flow started successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async startProcessSutraFlow(@Body() dto: StartFlowDto) {
    this.logger.log(`Starting Process Sutra flow for system: ${dto.systemName}`);
    return this.processSutra.startFlow(
      dto.apiKey,
      dto.systemName,
      {
        system: dto.systemName,
        orderNumber: dto.orderNumber || '',
        description: dto.description || '',
        initialFormData: dto.initialFormData || {},
        notifyAssignee: dto.notifyAssignee,
      },
    );
  }

  @Post('indiamart/fetch-leads')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fetch recent leads from IndiaMART (Pull API v2)' })
  @ApiResponse({ status: 200, description: 'Leads fetched successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async fetchIndiamartLeads(@Body() dto: FetchIndiamartDto) {
    this.logger.log('Fetching IndiaMART leads');
    return this.indiamart.fetchLeads(dto.apiKey, dto.startTime, dto.endTime);
  }

  @Post('indiamart/auto-import')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Auto-import IndiaMART leads into a campaign' })
  @ApiResponse({ status: 200, description: 'Leads imported successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async autoImportIndiamartLeads(@Body() dto: AutoImportIndiamartDto) {
    this.logger.log(`Auto-importing IndiaMART leads to campaign: ${dto.campaignId}`);
    const result = await this.indiamart.autoImportLeads(
      dto.campaignId,
      dto.apiKey,
      dto.startTime,
      dto.endTime,
    );

    // Update last fetch time
    await this.indiamart.updateLastFetchTime(new Date().toISOString());

    return result;
  }

  @Post('indiamart/test-connection')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test IndiaMART API connection' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  async testIndiamartConnection(@Body() dto: FetchIndiamartDto) {
    this.logger.log('Testing IndiaMART connection');
    try {
      const result = await this.indiamart.fetchLeads(dto.apiKey, dto.startTime, dto.endTime);
      return {
        success: true,
        message: `Connected. Found ${result.count} leads.`,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get('indiamart/last-fetch')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get last IndiaMART fetch time' })
  async getLastFetchTime() {
    const lastFetchTime = await this.indiamart.getLastFetchTime();
    return { lastFetchTime };
  }

  @Post('process-sutra/test-connection')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test Process Sutra API connection' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  async testProcessSutraConnection(@Body() dto: StartFlowDto) {
    this.logger.log('Testing Process Sutra connection');
    try {
      const result = await this.processSutra.startFlow(
        dto.apiKey,
        dto.systemName,
        {
          system: dto.systemName,
          orderNumber: 'TEST-' + Date.now(),
          description: 'Connection test from Muxro CRM Cloud',
          initialFormData: { test: true },
          notifyAssignee: false,
        },
      );
      return {
        success: true,
        message: 'Process Sutra connected successfully',
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
