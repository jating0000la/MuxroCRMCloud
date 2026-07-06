import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProcessSutraService } from './process-sutra.service';
import { IndiamartService } from './indiamart.service';
import { StartFlowDto, FetchIndiamartDto } from './dto/integration.dto';

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
  @ApiOperation({ summary: 'Fetch recent leads from Indiamart' })
  @ApiResponse({ status: 200, description: 'Leads fetched successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async fetchIndiamartLeads(@Body() dto: FetchIndiamartDto) {
    this.logger.log('Fetching Indiamart leads');
    return this.indiamart.fetchLeads(dto.apiKey, dto.webappUrl || '');
  }

  @Post('indiamart/test-connection')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test Indiamart API connection' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  async testIndiamartConnection(@Body() dto: FetchIndiamartDto) {
    this.logger.log('Testing Indiamart connection');
    try {
      const result = await this.indiamart.fetchLeads(dto.apiKey, dto.webappUrl || '');
      return {
        success: true,
        message: `Connected. Found ${result.count} recent leads.`,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
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
