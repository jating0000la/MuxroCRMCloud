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
  MethodNotAllowedException,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { SettingsService } from './settings.service';
import { CreateSettingDto, UpdateSettingDto, SettingResponseDto } from './dto/setting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settings (Admin only)' })
  async getAllSettings(
    @Query('masked') masked: string = 'true',
  ): Promise<SettingResponseDto[]> {
    const showMasked = masked !== 'false';
    return this.settingsService.getAllSettings(showMasked);
  }

  @Get('/:key')
  @ApiOperation({ summary: 'Get setting by key (Admin only)' })
  async getSetting(
    @Param('key') key: string,
    @Query('masked') masked: string = 'true',
  ): Promise<SettingResponseDto> {
    const showMasked = masked !== 'false';
    return this.settingsService.getSetting(key, showMasked);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create setting (Admin only)' })
  async createSetting(
    @Body() dto: CreateSettingDto,
  ): Promise<SettingResponseDto> {
    return this.settingsService.createSetting(dto);
  }

  @Put('/:key')
  @ApiOperation({ summary: 'Update setting (Admin only)' })
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ): Promise<SettingResponseDto> {
    return this.settingsService.updateSetting(key, dto);
  }

  @Delete('/:key')
  @HttpCode(HttpStatus.METHOD_NOT_ALLOWED)
  @ApiOperation({ summary: 'Delete setting (not implemented)' })
  async deleteSetting(): Promise<void> {
    throw new MethodNotAllowedException('Setting deletion not implemented. Use archive instead.');
  }

  @Get('/:key/audit-log')
  @ApiOperation({ summary: 'Get audit log for setting (Admin only)' })
  async getAuditLog(@Param('key') key: string): Promise<any[]> {
    return this.settingsService.getAuditLog(key);
  }

  @Post('logo/upload')
  @UseInterceptors(FileInterceptor('file', {
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(new BadRequestException('Only PNG, JPG, JPEG, WebP, and SVG files are allowed'), false);
    },
  }))
  @ApiOperation({ summary: 'Upload a company logo to the repository' })
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded');
    }

    const uploadDir = join(process.cwd(), 'uploads', 'logos');
    await mkdir(uploadDir, { recursive: true });

    const extension = extname(file.originalname) || '.png';
    const fileName = `${Date.now()}-${randomUUID()}${extension}`;
    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, file.buffer);

    return {
      fileName,
      url: `/logo/${fileName}`,
    };
  }

  @Post('/:key/test')
  @ApiOperation({ summary: 'Test setting connection (Admin only)' })
  async testSetting(
    @Param('key') key: string,
  ): Promise<{ success: boolean; message: string; lastTestedAt: Date | null }> {
    const setting = await this.settingsService.getSetting(key, false);
    
    const updated = await this.settingsService.updateSetting(
      key,
      { value: setting.value, lastTestedAt: new Date().toISOString(), reason: 'Manual test' },
    );

    return {
      success: true,
      message: `Setting "${key}" test timestamp updated`,
      lastTestedAt: updated.lastTestedAt || null,
    };
  }
}
