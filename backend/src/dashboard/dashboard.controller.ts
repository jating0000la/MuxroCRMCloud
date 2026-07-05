import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  getFollowupDashboard(@Request() req, @Query('campaignId') campaignId?: string) {
    return this.dashboardService.getFollowupDashboard(req.user.id, req.user.role, campaignId);
  }

  @Get('leads')
  @ApiOperation({ summary: 'Get all leads dashboard data' })
  @ApiQuery({ name: 'campaignId', required: false })
  getAllLeadsDashboard(@Request() req, @Query('campaignId') campaignId?: string) {
    return this.dashboardService.getAllLeadsDashboard(req.user.id, req.user.role, campaignId);
  }
}
