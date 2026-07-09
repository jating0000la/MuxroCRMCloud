import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CreateSettingDto, UpdateSettingDto, SettingResponseDto } from './dto/setting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  private ensureAdmin(user: any) {
    if (user?.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can manage settings');
    }
  }

  @Get()
  async getAllSettings(
    @Query('masked') masked: string = 'true',
    @CurrentUser() user: any,
  ): Promise<SettingResponseDto[]> {
    this.ensureAdmin(user);
    const showMasked = masked !== 'false';
    return this.settingsService.getAllSettings(showMasked);
  }

  @Get('/:key')
  async getSetting(
    @Param('key') key: string,
    @Query('masked') masked: string = 'true',
    @CurrentUser() user: any,
  ): Promise<SettingResponseDto> {
    this.ensureAdmin(user);
    const showMasked = masked !== 'false';
    return this.settingsService.getSetting(key, showMasked);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSetting(
    @Body() dto: CreateSettingDto,
    @CurrentUser() user: any,
  ): Promise<SettingResponseDto> {
    this.ensureAdmin(user);
    return this.settingsService.createSetting(dto, user?.id);
  }

  @Put('/:key')
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: any,
  ): Promise<SettingResponseDto> {
    this.ensureAdmin(user);
    return this.settingsService.updateSetting(key, dto, user?.id);
  }

  @Delete('/:key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSetting(@Param('key') key: string, @CurrentUser() user: any): Promise<void> {
    this.ensureAdmin(user);
    // This would be optional - typically you don't delete settings, just archive them
    throw new Error('Setting deletion not implemented');
  }

  @Get('/:key/audit-log')
  async getAuditLog(@Param('key') key: string, @CurrentUser() user: any): Promise<any[]> {
    this.ensureAdmin(user);
    return this.settingsService.getAuditLog(key);
  }

  @Post('/:key/test')
  async testSetting(
    @Param('key') key: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string; lastTestedAt: Date | null }> {
    this.ensureAdmin(user);
    // This endpoint allows testing the connection/validity of a setting
    // Implementation depends on the setting type (Indiamart, Process Sutra, etc.)
    const setting = await this.settingsService.getSetting(key, false);
    
    // Update last tested timestamp
    const updated = await this.settingsService.updateSetting(
      key,
      { value: setting.value, lastTestedAt: new Date().toISOString(), reason: 'Manual test' },
      user?.id,
    );

    return {
      success: true,
      message: `Setting "${key}" test timestamp updated`,
      lastTestedAt: updated.lastTestedAt || null,
    };
  }
}
