import { Controller, Get, Post, Param, Body, Req, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { FormsService } from './forms.service';

@ApiTags('Public Forms')
@Controller('forms/public')
export class PublicFormsController implements OnModuleInit {
  private enabled = true;

  constructor(
    private formsService: FormsService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    this.enabled = this.config.get<string>('PUBLIC_FORMS_ENABLED', 'true') === 'true';
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get public form by slug' })
  getForm(@Param('slug') slug: string) {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Public forms are disabled');
    }
    return this.formsService.findBySlug(slug);
  }

  @Post(':slug/submit')
  @ApiOperation({ summary: 'Submit public form' })
  submitForm(@Param('slug') slug: string, @Body() body: { data: Record<string, any> }, @Req() req) {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Public forms are disabled');
    }
    const ipAddress = req.ip || req.connection?.remoteAddress;
    return this.formsService.submitForm(slug, body?.data || {}, ipAddress);
  }
}
