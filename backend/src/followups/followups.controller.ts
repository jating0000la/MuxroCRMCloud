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
  findByLead(@Param('leadId') leadId: string) {
    return this.followupsService.findByLead(leadId);
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
  update(@Param('id') id: string, @Body() dto: UpdateFollowupDto) {
    return this.followupsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a follow-up' })
  remove(@Param('id') id: string) {
    return this.followupsService.remove(id);
  }
}
