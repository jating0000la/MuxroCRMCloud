import {
  Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AssignUsersDto } from './dto/assign-users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private campaignsService: CampaignsService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a campaign' })
  create(@Body() dto: CreateCampaignDto, @Request() req) {
    return this.campaignsService.create(dto, req.user.id);
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get all campaigns (role-based)' })
  findAll(@Request() req) {
    return this.campaignsService.findAll(req.user.id, req.user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign details' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.campaignsService.findOne(id, req.user.id, req.user.role);
  }

  @Put(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update campaign' })
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto, @Request() req) {
    return this.campaignsService.update(id, dto, req.user.id, req.user.role);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Deactivate campaign' })
  remove(@Param('id') id: string, @Request() req) {
    return this.campaignsService.remove(id, req.user.id, req.user.role);
  }

  @Post(':id/users')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Assign users to campaign' })
  assignUsers(@Param('id') id: string, @Body() dto: AssignUsersDto, @Request() req) {
    return this.campaignsService.assignUsers(id, dto, req.user.id, req.user.role);
  }

  @Delete(':id/users/:userId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Remove user from campaign' })
  removeUser(@Param('id') id: string, @Param('userId') userId: string, @Request() req) {
    return this.campaignsService.removeUser(id, userId, req.user.id, req.user.role);
  }

  @Get(':id/users')
  @ApiOperation({ summary: 'Get assigned users' })
  getAssignedUsers(@Param('id') id: string, @Request() req) {
    return this.campaignsService.getAssignedUsers(id, req.user.id, req.user.role);
  }
}
