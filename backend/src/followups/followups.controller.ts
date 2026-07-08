import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FollowupsService } from './followups.service';
import { CreateFollowupDto } from './dto/create-followup.dto';
import { UpdateFollowupDto } from './dto/update-followup.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Followups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('followups')
export class FollowupsController {
  constructor(private followupsService: FollowupsService) {}

  @Get('lead/:leadId')
  @ApiOperation({ summary: 'Get follow-ups for a lead' })
  findByLead(@Param('leadId') leadId: string, @Request() req) {
    return this.followupsService.findByLead(leadId, req.user.id, req.user.role);
  }

  @Get('cross-campaign')
  @ApiOperation({ summary: 'Find follow-ups across campaigns by phone or email' })
  @ApiQuery({ name: 'phone', required: false })
  @ApiQuery({ name: 'email', required: false })
  @ApiQuery({ name: 'excludeLeadId', required: false })
  findCrossCampaign(
    @Query('phone') phone?: string,
    @Query('email') email?: string,
    @Query('excludeLeadId') excludeLeadId?: string,
    @Request() req?: any,
  ) {
    return this.followupsService.findCrossCampaign(phone, email, excludeLeadId, req?.user?.id, req?.user?.role);
  }

  @Post()
  @ApiOperation({ summary: 'Create a follow-up' })
  create(@Body() dto: CreateFollowupDto, @Request() req) {
    return this.followupsService.create(dto, req.user.id);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my follow-ups' })
  @ApiQuery({ name: 'campaignId', required: false })
  getMyFollowups(@Request() req, @Query('campaignId') campaignId?: string) {
    return this.followupsService.getMyFollowups(req.user.id, campaignId);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming scheduled follow-ups' })
  @ApiQuery({ name: 'campaignId', required: false })
  getUpcomingFollowups(@Request() req, @Query('campaignId') campaignId?: string) {
    return this.followupsService.getUpcomingFollowups(req.user.id, campaignId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a follow-up' })
  update(@Param('id') id: string, @Body() dto: UpdateFollowupDto, @Request() req) {
    return this.followupsService.update(id, dto, req.user.id, req.user.role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a follow-up' })
  remove(@Param('id') id: string, @Request() req) {
    return this.followupsService.remove(id, req.user.id, req.user.role);
  }
}
