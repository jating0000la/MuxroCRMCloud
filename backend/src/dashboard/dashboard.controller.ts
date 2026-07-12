import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get dashboard overview stats' })
  getOverview(@Request() req) {
    return this.dashboardService.getOverview(req.user.id, req.user.role);
  }

  @Get('campaign-stats/:campaignId')
  @ApiOperation({ summary: 'Get campaign-specific stats' })
  getCampaignStats(@Param('campaignId') campaignId: string) {
    return this.dashboardService.getCampaignStats(campaignId);
  }

  @Get('followups')
  @ApiOperation({ summary: 'Get follow-up dashboard data' })
  @ApiQuery({ name: 'campaignId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getFollowupDashboard(
    @Request() req,
    @Query('campaignId') campaignId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1') || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit || '50') || 50));
    return this.dashboardService.getFollowupDashboard(req.user.id, req.user.role, campaignId, pageNum, limitNum);
  }

  @Get('leads')
  @ApiOperation({ summary: 'Get all leads dashboard data' })
  @ApiQuery({ name: 'campaignId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getAllLeadsDashboard(
    @Request() req,
    @Query('campaignId') campaignId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1') || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit || '50') || 50));
    return this.dashboardService.getAllLeadsDashboard(req.user.id, req.user.role, campaignId, pageNum, limitNum);
  }

  @Get('sales-funnel')
  @ApiOperation({ summary: 'Get sales funnel data' })
  @ApiQuery({ name: 'campaignId', required: false })
  getSalesFunnel(@Request() req, @Query('campaignId') campaignId?: string) {
    return this.dashboardService.getSalesFunnel(req.user.id, req.user.role, campaignId);
  }

  @Get('user-conversion')
  @ApiOperation({ summary: 'Get user-wise conversion ratio' })
  @ApiQuery({ name: 'campaignId', required: false })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  getUserConversion(
    @Request() req,
    @Query('campaignId') campaignId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getUserConversion(req.user.id, req.user.role, campaignId, startDate, endDate);
  }
}
