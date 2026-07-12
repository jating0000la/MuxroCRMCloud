import {
  Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CampaignStatusesService } from './campaign-statuses.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Campaign Statuses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('campaigns/:campaignId/statuses')
export class CampaignStatusesController {
  constructor(
    private statusesService: CampaignStatusesService,
    private authService: AuthorizationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all statuses for campaign' })
  async findAll(@Param('campaignId') campaignId: string, @Request() req) {
    await this.authService.ensureCampaignAccess(campaignId, req.user.id, req.user.role);
    return this.statusesService.findAll(campaignId);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a new status' })
  create(
    @Param('campaignId') campaignId: string,
    @Body() body: { label: string; color?: string; whatsappMessage?: string },
  ) {
    return this.statusesService.create(campaignId, body);
  }

  @Put(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a status' })
  update(
    @Param('id') id: string,
    @Body() body: { label?: string; color?: string; order?: number; whatsappMessage?: string },
  ) {
    return this.statusesService.update(id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a status' })
  remove(@Param('id') id: string) {
    return this.statusesService.remove(id);
  }
}
