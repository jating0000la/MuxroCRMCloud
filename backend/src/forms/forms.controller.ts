import {
  Controller, Get, Post, Put, Delete, Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FormsService } from './forms.service';
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
  constructor(private formsService: FormsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a form for campaign' })
  create(@Param('campaignId') campaignId: string, @Body() dto: CreateFormDto) {
    return this.formsService.create(campaignId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all forms for campaign' })
  findAll(@Param('campaignId') campaignId: string) {
    return this.formsService.findByCampaign(campaignId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get form details' })
  findOne(@Param('id') id: string) {
    return this.formsService.findOne(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update form' })
  update(@Param('id') id: string, @Body() dto: UpdateFormDto) {
    return this.formsService.update(id, dto);
  }

  @Post(':id/publish')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Publish form' })
  publish(@Param('id') id: string) {
    return this.formsService.publish(id);
  }

  @Post(':id/unpublish')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Unpublish form' })
  unpublish(@Param('id') id: string) {
    return this.formsService.unpublish(id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete form' })
  remove(@Param('id') id: string) {
    return this.formsService.remove(id);
  }

  @Get(':id/submissions')
  @ApiOperation({ summary: 'Get form submissions' })
  getSubmissions(@Param('id') id: string) {
    return this.formsService.getSubmissions(id);
  }
}
