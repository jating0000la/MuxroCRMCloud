import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private dashboardService: DashboardService,
    private authService: AuthorizationService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get dashboard overview stats' })
  getOverview(@Request() req) {
    return this.dashboardService.getOverview(req.user.id, req.user.role);
  }

  @Get('campaign-stats/:campaignId')
  @ApiOperation({ summary: 'Get campaign-specific stats' })
  async getCampaignStats(@Param('campaignId') campaignId: string, @Request() req) {
    await this.authService.ensureCampaignAccess(campaignId, req.user.id, req.user.role);
    return this.dashboardService.getCampaignStats(campaignId);
  }

  @Get('followups')
  @ApiOperation({ summary: 'Get follow-up dashboard data' })
  @ApiQuery({ name: 'campaignId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getFollowupDashboard(
    @Request() req,
    @Query('campaignId') campaignId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (campaignId) {
      await this.authService.ensureCampaignAccess(campaignId, req.user.id, req.user.role);
    }
    const pageNum = Math.max(1, parseInt(page || '1') || 1);
    const limitNum = Math.min(20000, Math.max(1, parseInt(limit || '50') || 50));
    return this.dashboardService.getFollowupDashboard(req.user.id, req.user.role, campaignId, pageNum, limitNum);
  }

  @Get('leads')
  @ApiOperation({ summary: 'Get all leads dashboard data' })
  @ApiQuery({ name: 'campaignId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAllLeadsDashboard(
    @Request() req,
    @Query('campaignId') campaignId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (campaignId) {
      await this.authService.ensureCampaignAccess(campaignId, req.user.id, req.user.role);
    }
    const pageNum = Math.max(1, parseInt(page || '1') || 1);
    const limitNum = Math.min(20000, Math.max(1, parseInt(limit || '50') || 50));
    return this.dashboardService.getAllLeadsDashboard(req.user.id, req.user.role, campaignId, pageNum, limitNum);
  }

  @Get('sales-funnel')
  @ApiOperation({ summary: 'Get sales funnel data' })
  @ApiQuery({ name: 'campaignId', required: false })
  async getSalesFunnel(@Request() req, @Query('campaignId') campaignId?: string) {
    if (campaignId) {
      await this.authService.ensureCampaignAccess(campaignId, req.user.id, req.user.role);
    }
    return this.dashboardService.getSalesFunnel(req.user.id, req.user.role, campaignId);
  }

  @Get('user-conversion')
  @ApiOperation({ summary: 'Get user-wise conversion ratio' })
  @ApiQuery({ name: 'campaignId', required: false })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  async getUserConversion(
    @Request() req,
    @Query('campaignId') campaignId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (campaignId) {
      await this.authService.ensureCampaignAccess(campaignId, req.user.id, req.user.role);
    }
    return this.dashboardService.getUserConversion(req.user.id, req.user.role, campaignId, startDate, endDate);
  }

  @Get('kpi')
  @ApiOperation({ summary: 'Get KPI overview' })
  @ApiQuery({ name: 'campaignId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getKpi(
    @Request() req,
    @Query('campaignId') campaignId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (campaignId) {
      await this.authService.ensureCampaignAccess(campaignId, req.user.id, req.user.role);
    }
    return this.dashboardService.getKpiOverview(req.user.id, req.user.role, campaignId, startDate, endDate);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get business alerts' })
  async getAlerts(@Request() req) {
    return this.dashboardService.getBusinessAlerts(req.user.id, req.user.role);
  }

  @Get('campaign-report')
  @ApiOperation({ summary: 'Get campaign-wise report' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getCampaignReport(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getCampaignWiseReport(req.user.id, req.user.role, startDate, endDate);
  }

  @Get('status-report')
  @ApiOperation({ summary: 'Get status-wise report' })
  @ApiQuery({ name: 'campaignId', required: false })
  async getStatusReport(@Request() req, @Query('campaignId') campaignId?: string) {
    if (campaignId) {
      await this.authService.ensureCampaignAccess(campaignId, req.user.id, req.user.role);
    }
    return this.dashboardService.getStatusWiseReport(req.user.id, req.user.role, campaignId);
  }

  @Get('daily-trend')
  @ApiOperation({ summary: 'Get daily trend data' })
  @ApiQuery({ name: 'campaignId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getDailyTrend(
    @Request() req,
    @Query('campaignId') campaignId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (campaignId) {
      await this.authService.ensureCampaignAccess(campaignId, req.user.id, req.user.role);
    }
    return this.dashboardService.getDailyTrend(req.user.id, req.user.role, campaignId, startDate, endDate);
  }

  @Get('missed-by-user')
  @ApiOperation({ summary: 'Get missed followups by user' })
  @ApiQuery({ name: 'campaignId', required: false })
  async getMissedByUser(@Request() req, @Query('campaignId') campaignId?: string) {
    if (campaignId) {
      await this.authService.ensureCampaignAccess(campaignId, req.user.id, req.user.role);
    }
    return this.dashboardService.getMissedByUser(req.user.id, req.user.role, campaignId);
  }
}
