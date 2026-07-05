import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leads')
export class LeadsController {
  constructor(private leadsService: LeadsService) {}

  @Get('campaign/:campaignId')
  @ApiOperation({ summary: 'Get leads by campaign' })
  findByCampaign(
    @Param('campaignId') campaignId: string,
    @Request() req,
  ) {
    return this.leadsService.findByCampaign(campaignId, req.user.id, req.user.role);
  }

  @Get('dnd')
  @ApiOperation({ summary: 'Get DND leads' })
  findDnd(@Request() req) {
    return this.leadsService.findDnd(req.user.id, req.user.role);
  }

  @Get('stats/:campaignId')
  @ApiOperation({ summary: 'Get lead stats by campaign' })
  getStats(@Param('campaignId') campaignId: string) {
    return this.leadsService.getStats(campaignId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead details' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.leadsService.findOne(id, req.user.id, req.user.role);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a lead' })
  create(@Body() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update lead' })
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto, @Request() req) {
    return this.leadsService.update(id, dto, req.user.id, req.user.role);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update lead status with follow-up' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @Request() req) {
    return this.leadsService.updateStatus(id, dto, req.user.id, req.user.role);
  }

  @Post('bulk-allocate/:campaignId')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Allocate leads round-robin' })
  allocateRoundRobin(
    @Param('campaignId') campaignId: string,
    @Body() body: { leadIds: string[] },
  ) {
    return this.leadsService.allocateRoundRobin(campaignId, body.leadIds);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Delete lead' })
  remove(@Param('id') id: string, @Request() req) {
    return this.leadsService.remove(id, req.user.id, req.user.role);
  }
}
