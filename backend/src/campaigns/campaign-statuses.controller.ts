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
  async create(
    @Param('campaignId') campaignId: string,
    @Body() body: { label: string; color?: string; whatsappMessage?: string },
  ) {
    if (!body.label || typeof body.label !== 'string' || body.label.trim().length === 0) {
      throw new (await import('@nestjs/common')).BadRequestException('label is required');
    }
    if (body.label.length > 50) {
      throw new (await import('@nestjs/common')).BadRequestException('label must be 50 characters or less');
    }
    return this.statusesService.create(campaignId, { ...body, label: body.label.trim() });
  }

  @Put(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a status' })
  async update(
    @Param('id') id: string,
    @Body() body: { label?: string; color?: string; order?: number; whatsappMessage?: string },
  ) {
    if (body.label !== undefined && (typeof body.label !== 'string' || body.label.trim().length === 0)) {
      throw new (await import('@nestjs/common')).BadRequestException('label cannot be empty');
    }
    if (body.label && body.label.length > 50) {
      throw new (await import('@nestjs/common')).BadRequestException('label must be 50 characters or less');
    }
    const sanitized = body.label ? { ...body, label: body.label.trim() } : body;
    return this.statusesService.update(id, sanitized);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a status' })
  remove(@Param('id') id: string) {
    return this.statusesService.remove(id);
  }
}
