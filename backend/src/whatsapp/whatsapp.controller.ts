import { Controller, Post, Get, Body, Query, UseGuards, HttpCode, HttpStatus, Logger, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatQueryDto } from './dto/chat-query.dto';
import { WhatsAppService } from './whatsapp.service';
import {
  SendTextDto,
  SendImageDto,
  SendVideoDto,
  SendAudioDto,
  SendFileDto,
  SendLocationDto,
  SendContactDto,
  SendQuickReplyDto,
  SendListDto,
  SendWhatsAppTemplateDto,
  SendBroadcastDto,
} from './dto/whatsapp.dto';

@ApiTags('WhatsApp Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(private whatsapp: WhatsAppService) {}

  // ─── Chat Inbox ───────────────────────────────────────────────────────────

  @Get('chats')
  @ApiOperation({ summary: 'Get all chat conversations (grouped by phone)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getChats(
    @Query() query: ChatQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.whatsapp.getChats(user.id, user.role, query.limit, query.offset);
  }

  @Get('chats/:phone/messages')
  @ApiOperation({ summary: 'Get messages for a specific phone number' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getChatMessages(
    @Param('phone') phone: string,
    @Query() query: ChatQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.whatsapp.getChatMessages(phone, user.id, user.role, query.limit, query.offset);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get WhatsApp message statistics' })
  async getStats(@CurrentUser() user: any) {
    return this.whatsapp.getChatStats(user.id, user.role);
  }

  // ─── Send Messages (All Types) ────────────────────────────────────────────

  @Post('send/text')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a text message' })
  async sendText(@Body() dto: SendTextDto, @CurrentUser() user: any) {
    const target = await this.whatsapp.ensureSendAccess(dto, user);
    return this.whatsapp.sendText(dto.phone, dto.text, dto.previewUrl, {
      ...target,
      userId: user.id,
    });
  }

  @Post('send/image')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an image message' })
  async sendImage(@Body() dto: SendImageDto, @CurrentUser() user: any) {
    const target = await this.whatsapp.ensureSendAccess(dto, user);
    return this.whatsapp.sendImage(dto.phone, dto.url, dto.caption, {
      ...target,
      userId: user.id,
    });
  }

  @Post('send/video')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a video message' })
  async sendVideo(@Body() dto: SendVideoDto, @CurrentUser() user: any) {
    const target = await this.whatsapp.ensureSendAccess(dto, user);
    return this.whatsapp.sendVideo(dto.phone, dto.url, dto.caption, {
      ...target,
      userId: user.id,
    });
  }

  @Post('send/audio')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an audio message' })
  async sendAudio(@Body() dto: SendAudioDto, @CurrentUser() user: any) {
    const target = await this.whatsapp.ensureSendAccess(dto, user);
    return this.whatsapp.sendAudio(dto.phone, dto.url, {
      ...target,
      userId: user.id,
    });
  }

  @Post('send/file')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a file/document message' })
  async sendFile(@Body() dto: SendFileDto, @CurrentUser() user: any) {
    const target = await this.whatsapp.ensureSendAccess(dto, user);
    return this.whatsapp.sendFile(dto.phone, dto.url, dto.filename, dto.caption, {
      ...target,
      userId: user.id,
    });
  }

  @Post('send/location')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a location message' })
  async sendLocation(@Body() dto: SendLocationDto, @CurrentUser() user: any) {
    const target = await this.whatsapp.ensureSendAccess(dto, user);
    return this.whatsapp.sendLocation(dto.phone, dto.latitude, dto.longitude, dto.name, dto.address, {
      ...target,
      userId: user.id,
    });
  }

  @Post('send/contact')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a contact card message' })
  async sendContact(@Body() dto: SendContactDto, @CurrentUser() user: any) {
    const target = await this.whatsapp.ensureSendAccess(dto, user);
    return this.whatsapp.sendContact(dto.phone, dto.firstName, dto.lastName, dto.contactPhone, dto.email, dto.company, {
      ...target,
      userId: user.id,
    });
  }

  @Post('send/quick-reply')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a quick-reply button message (max 3 buttons)' })
  async sendQuickReply(@Body() dto: SendQuickReplyDto, @CurrentUser() user: any) {
    const target = await this.whatsapp.ensureSendAccess(dto, user);
    return this.whatsapp.sendQuickReply(dto.phone, dto.text, dto.buttons, dto.header, dto.footer, {
      ...target,
      userId: user.id,
    });
  }

  @Post('send/list')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a list/menu message' })
  async sendList(@Body() dto: SendListDto, @CurrentUser() user: any) {
    const target = await this.whatsapp.ensureSendAccess(dto, user);
    return this.whatsapp.sendList(dto.phone, dto.header, dto.text, dto.items, dto.footer, dto.buttonLabel, {
      ...target,
      userId: user.id,
    });
  }

  @Post('send/template')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a template (HSM) message' })
  async sendTemplate(@Body() dto: SendWhatsAppTemplateDto, @CurrentUser() user: any) {
    const target = await this.whatsapp.ensureSendAccess(dto, user);
    return this.whatsapp.sendTemplate(dto.phone, dto.templateId, dto.templateParams, dto.mediaType, dto.mediaUrl, {
      ...target,
      userId: user.id,
    });
  }

  @Post('send/broadcast')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a broadcast (max 50 messages)' })
  async sendBroadcast(@Body() dto: SendBroadcastDto) {
    return this.whatsapp.sendBroadcast(dto.items);
  }

  // ─── Contacts ─────────────────────────────────────────────────────────────

  @Get('contacts')
  @ApiOperation({ summary: 'Get WhatsApp contacts' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getContacts(
    @Query() query: ChatQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.whatsapp.getContacts(user.id, user.role, query.limit, query.offset);
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  @Post('sync-templates')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync approved templates from Gupshup' })
  async syncTemplates() {
    return this.whatsapp.syncTemplates();
  }
}
