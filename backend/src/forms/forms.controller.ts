import {
  Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FormsService } from './forms.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Forms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('campaigns/:campaignId/forms')
export class FormsController {
  constructor(
    private formsService: FormsService,
    private authService: AuthorizationService,
  ) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a form for campaign' })
  create(@Param('campaignId') campaignId: string, @Body() dto: CreateFormDto) {
    return this.formsService.create(campaignId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all forms for campaign' })
  async findAll(@Param('campaignId') campaignId: string, @Request() req) {
    await this.authService.ensureCampaignAccess(campaignId, req.user.id, req.user.role);
    return this.formsService.findByCampaign(campaignId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get form details' })
  async findOne(@Param('id') id: string, @Request() req) {
    const form = await this.formsService.findOne(id);
    await this.authService.ensureCampaignAccess((form as any).campaignId || '', req.user.id, req.user.role);
    return form;
  }

  @Put(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update form' })
  async update(@Param('id') id: string, @Body() dto: UpdateFormDto, @Request() req) {
    const form = await this.formsService.findOne(id);
    await this.authService.ensureCampaignAccess((form as any).campaignId || '', req.user.id, req.user.role);
    return this.formsService.update(id, dto);
  }

  @Post(':id/publish')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Publish form' })
  async publish(@Param('id') id: string, @Request() req) {
    const form = await this.formsService.findOne(id);
    await this.authService.ensureCampaignAccess((form as any).campaignId || '', req.user.id, req.user.role);
    return this.formsService.publish(id);
  }

  @Post(':id/unpublish')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Unpublish form' })
  async unpublish(@Param('id') id: string, @Request() req) {
    const form = await this.formsService.findOne(id);
    await this.authService.ensureCampaignAccess((form as any).campaignId || '', req.user.id, req.user.role);
    return this.formsService.unpublish(id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete form' })
  async remove(@Param('id') id: string, @Request() req) {
    const form = await this.formsService.findOne(id);
    await this.authService.ensureCampaignAccess((form as any).campaignId || '', req.user.id, req.user.role);
    return this.formsService.remove(id);
  }

  @Get(':id/submissions')
  @ApiOperation({ summary: 'Get form submissions' })
  async getSubmissions(@Param('id') id: string, @Request() req) {
    const form = await this.formsService.findOne(id);
    await this.authService.ensureCampaignAccess((form as any).campaignId || '', req.user.id, req.user.role);
    return this.formsService.getSubmissions(id);
  }
}
