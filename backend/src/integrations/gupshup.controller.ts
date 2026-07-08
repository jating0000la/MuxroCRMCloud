import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Logger, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GupshupService } from './gupshup.service';
import { SendGupshupMessageDto, SendGupshupTemplateDto, TestGupshupDto } from './dto/integration.dto';
import { SettingsService } from '../settings/settings.service';

@ApiTags('Gupshup WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/gupshup')
export class GupshupController {
  private readonly logger = new Logger(GupshupController.name);

  constructor(
    private gupshup: GupshupService,
    private settingsService: SettingsService,
  ) {}

  @Post('send-message')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a WhatsApp session message via Gupshup' })
  @ApiResponse({ status: 200, description: 'Message sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async sendMessage(@Body() dto: SendGupshupMessageDto, @CurrentUser() user: { role?: string }) {
    this.logger.log(`Sending WhatsApp message to ${dto.destination}`);
    const apiKey = await this.resolveConfigValue('gupshupApiKey', dto.apiKey, user);
    const source = await this.resolveConfigValue('gupshupSource', dto.source, user);
    const appName = await this.resolveConfigValue('gupshupAppName', dto.appName, user);

    return this.gupshup.sendSessionMessage(
      apiKey,
      source,
      appName,
      dto.destination,
      dto.message,
      dto.disablePreview,
    );
  }

  @Post('send-template')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a WhatsApp template message via Gupshup' })
  @ApiResponse({ status: 200, description: 'Template sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async sendTemplate(@Body() dto: SendGupshupTemplateDto, @CurrentUser() user: { role?: string }) {
    this.logger.log(`Sending WhatsApp template to ${dto.destination}`);
    const apiKey = await this.resolveConfigValue('gupshupApiKey', dto.apiKey, user);
    const source = await this.resolveConfigValue('gupshupSource', dto.source, user);
    const appName = await this.resolveConfigValue('gupshupAppName', undefined, user);

    return this.gupshup.sendTemplateMessage(
      apiKey,
      source,
      appName,
      dto.destination,
      dto.templateId,
      dto.templateParams,
      dto.mediaMessage,
    );
  }

  @Post('test-connection')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test Gupshup WhatsApp connection' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  async testConnection(@Body() dto: TestGupshupDto, @CurrentUser() user: { role?: string }) {
    this.logger.log('Testing Gupshup connection');
    const apiKey = await this.resolveConfigValue('gupshupApiKey', dto.apiKey, user);
    const source = await this.resolveConfigValue('gupshupSource', dto.source, user);
    const appName = await this.resolveConfigValue('gupshupAppName', dto.appName, user);

    return this.gupshup.testConnection(
      apiKey,
      source,
      appName,
      dto.testPhone,
    );
  }

  @Post('sync-templates')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fetch approved WhatsApp templates from Gupshup' })
  async syncTemplates(@CurrentUser() user: { role?: string }) {
    this.logger.log('Syncing Gupshup templates');
    const apiKey = await this.resolveConfigValue('gupshupApiKey', undefined, user);
    const appId = await this.resolveConfigValue('gupshupAppId', undefined, user);
    return this.gupshup.syncTemplates(apiKey, appId);
  }

  private async resolveConfigValue(
    key: string,
    override: string | undefined,
    user: { role?: string } | undefined,
  ): Promise<string> {
    if (user?.role === 'ADMIN' && override?.trim()) {
      return override.trim();
    }

    try {
      const value = await this.settingsService.getSettingForUse(key);
      if (!value.trim()) {
        throw new BadRequestException(`Setting "${key}" is empty`);
      }
      return value.trim();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Missing required setting: ${key}`);
    }
  }

}
