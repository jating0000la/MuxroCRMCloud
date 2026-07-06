import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import { CreateSettingDto, UpdateSettingDto, SettingResponseDto } from './dto/setting.dto';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  private shouldMaskKey(key: string): boolean {
    // Only sensitive credentials should be masked in API responses.
    return /(apikey|api_key|token|secret|password|passphrase|privatekey|private_key)/i.test(key);
  }

  async getSetting(key: string, showMasked: boolean = true): Promise<SettingResponseDto> {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    // Decrypt the value
    let decryptedValue = setting.encryptedValue;
    if (setting.isEncrypted) {
      try {
        decryptedValue = this.encryption.decrypt(setting.encryptedValue);
      } catch (error) {
        console.error(`Failed to decrypt setting ${key}:`, error);
        decryptedValue = '';
      }
    }

    const isMasked = showMasked && this.shouldMaskKey(setting.key);
    return {
      key: setting.key,
      value: isMasked ? this.encryption.maskValue(decryptedValue) : decryptedValue,
      isMasked,
      lastTestedAt: setting.lastTestedAt,
      updatedAt: setting.updatedAt,
    };
  }

  async getAllSettings(showMasked: boolean = true): Promise<SettingResponseDto[]> {
    const settings = await this.prisma.setting.findMany({
      orderBy: { key: 'asc' },
    });

    return settings.map((setting) => {
      let decryptedValue = setting.encryptedValue;
      if (setting.isEncrypted) {
        try {
          decryptedValue = this.encryption.decrypt(setting.encryptedValue);
        } catch (error) {
          console.error(`Failed to decrypt setting ${setting.key}:`, error);
          decryptedValue = '';
        }
      }

      return {
        key: setting.key,
        value: showMasked && this.shouldMaskKey(setting.key)
          ? this.encryption.maskValue(decryptedValue)
          : decryptedValue,
        isMasked: showMasked && this.shouldMaskKey(setting.key),
        lastTestedAt: setting.lastTestedAt,
        updatedAt: setting.updatedAt,
      };
    });
  }

  async createSetting(dto: CreateSettingDto, userId?: string): Promise<SettingResponseDto> {
    // Check if setting already exists
    const existing = await this.prisma.setting.findUnique({
      where: { key: dto.key },
    });

    if (existing) {
      throw new Error(`Setting with key "${dto.key}" already exists`);
    }

    // Encrypt the value
    const encryptedValue = this.encryption.encrypt(dto.value);

    const setting = await this.prisma.setting.create({
      data: {
        key: dto.key,
        encryptedValue,
        isEncrypted: true,
      },
    });

    // Log the audit trail
    await this.prisma.settingAuditLog.create({
      data: {
        settingId: setting.id,
        action: 'create',
        changedBy: userId,
        newValue: this.encryption.maskValue(dto.value),
        reason: dto.reason,
      },
    });

    const isMasked = this.shouldMaskKey(setting.key);
    return {
      key: setting.key,
      value: isMasked ? this.encryption.maskValue(dto.value) : dto.value,
      isMasked,
      lastTestedAt: setting.lastTestedAt,
      updatedAt: setting.updatedAt,
    };
  }

  async updateSetting(key: string, dto: UpdateSettingDto, userId?: string): Promise<SettingResponseDto> {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    // Get old value for audit log
    let oldValue = setting.encryptedValue;
    if (setting.isEncrypted) {
      try {
        oldValue = this.encryption.decrypt(setting.encryptedValue);
      } catch (error) {
        oldValue = '[decryption failed]';
      }
    }

    // Encrypt the new value
    const encryptedValue = this.encryption.encrypt(dto.value);

    const updated = await this.prisma.setting.update({
      where: { key },
      data: {
        encryptedValue,
        isEncrypted: true,
        updatedAt: new Date(),
        lastTestedAt: dto.lastTestedAt ? new Date(dto.lastTestedAt) : undefined,
      },
    });

    // Log the audit trail
    await this.prisma.settingAuditLog.create({
      data: {
        settingId: setting.id,
        action: 'update',
        changedBy: userId,
        oldValue: this.encryption.maskValue(oldValue),
        newValue: this.encryption.maskValue(dto.value),
        reason: dto.reason,
      },
    });

    const isMasked = this.shouldMaskKey(updated.key);
    return {
      key: updated.key,
      value: isMasked ? this.encryption.maskValue(dto.value) : dto.value,
      isMasked,
      lastTestedAt: updated.lastTestedAt,
      updatedAt: updated.updatedAt,
    };
  }

  async getSettingForUse(key: string): Promise<string> {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    let decryptedValue = setting.encryptedValue;
    if (setting.isEncrypted) {
      try {
        decryptedValue = this.encryption.decrypt(setting.encryptedValue);
      } catch (error) {
        console.error(`Failed to decrypt setting ${key}:`, error);
        throw new Error(`Failed to retrieve setting ${key}`);
      }
    }

    return decryptedValue;
  }

  async getAuditLog(key: string): Promise<any[]> {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
      include: { auditLogs: { orderBy: { createdAt: 'desc' } } },
    });

    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    return setting.auditLogs;
  }
}
