import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GupshupService } from './gupshup.service';
import { SendGupshupMessageDto, SendGupshupTemplateDto, TestGupshupDto } from './dto/integration.dto';

@ApiTags('Gupshup WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/gupshup')
export class GupshupController {
  private readonly logger = new Logger(GupshupController.name);

  constructor(private gupshup: GupshupService) {}

  @Post('send-message')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a WhatsApp session message via Gupshup' })
  @ApiResponse({ status: 200, description: 'Message sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async sendMessage(@Body() dto: SendGupshupMessageDto) {
    this.logger.log(`Sending WhatsApp message to ${dto.destination}`);
    return this.gupshup.sendSessionMessage(
      dto.apiKey,
      dto.source,
      dto.appName,
      dto.destination,
      dto.message,
      dto.disablePreview,
    );
  }

  @Post('send-template')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a WhatsApp template message via Gupshup' })
  @ApiResponse({ status: 200, description: 'Template sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async sendTemplate(@Body() dto: SendGupshupTemplateDto) {
    this.logger.log(`Sending WhatsApp template to ${dto.destination}`);
    return this.gupshup.sendTemplateMessage(
      dto.apiKey,
      dto.source,
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
  async testConnection(@Body() dto: TestGupshupDto) {
    this.logger.log('Testing Gupshup connection');
    return this.gupshup.testConnection(
      dto.apiKey,
      dto.source,
      dto.appName,
      dto.testPhone,
    );
  }

}
