import { Controller, Get, Post, Param, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FormsService } from './forms.service';

@ApiTags('Public Forms')
@Controller('forms/public')
export class PublicFormsController {
  constructor(private formsService: FormsService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Get public form by slug' })
  getForm(@Param('slug') slug: string) {
    return this.formsService.findBySlug(slug);
  }

  @Post(':slug/submit')
  @ApiOperation({ summary: 'Submit public form' })
  submitForm(@Param('slug') slug: string, @Body() body: { data: Record<string, any> }, @Req() req) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    return this.formsService.submitForm(slug, body.data, ipAddress);
  }
}
