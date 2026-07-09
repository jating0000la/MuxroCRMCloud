import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { settings, settingAuditLogs } from '../db/schema';
import { EncryptionService } from './encryption.service';
import { CreateSettingDto, UpdateSettingDto, SettingResponseDto } from './dto/setting.dto';

@Injectable()
export class SettingsService {
  constructor(
    private database: DatabaseService,
    private encryption: EncryptionService,
  ) {}

  private shouldMaskKey(key: string): boolean {
    return /(apikey|api_key|token|secret|password|passphrase|privatekey|private_key)/i.test(key);
  }

  async getSetting(key: string, showMasked: boolean = true): Promise<SettingResponseDto> {
    const [setting] = await this.database.db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

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
    const allSettings = await this.database.db
      .select()
      .from(settings)
      .orderBy(settings.key);

    return allSettings.map((setting) => {
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
    const [existing] = await this.database.db
      .select()
      .from(settings)
      .where(eq(settings.key, dto.key))
      .limit(1);

    if (existing) {
      throw new Error(`Setting with key "${dto.key}" already exists`);
    }

    const encryptedValue = this.encryption.encrypt(dto.value);

    const [setting] = await this.database.db
      .insert(settings)
      .values({
        key: dto.key,
        encryptedValue,
        isEncrypted: true,
      })
      .returning();

    await this.database.db.insert(settingAuditLogs).values({
      settingId: setting.id,
      action: 'create',
      changedBy: userId,
      newValue: this.encryption.maskValue(dto.value),
      reason: dto.reason,
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
    const [setting] = await this.database.db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    let oldValue = setting.encryptedValue;
    if (setting.isEncrypted) {
      try {
        oldValue = this.encryption.decrypt(setting.encryptedValue);
      } catch (error) {
        oldValue = '[decryption failed]';
      }
    }

    const encryptedValue = this.encryption.encrypt(dto.value);

    const [updated] = await this.database.db
      .update(settings)
      .set({
        encryptedValue,
        isEncrypted: true,
        updatedAt: new Date(),
        lastTestedAt: dto.lastTestedAt ? new Date(dto.lastTestedAt) : undefined,
      })
      .where(eq(settings.key, key))
      .returning();

    await this.database.db.insert(settingAuditLogs).values({
      settingId: setting.id,
      action: 'update',
      changedBy: userId,
      oldValue: this.encryption.maskValue(oldValue),
      newValue: this.encryption.maskValue(dto.value),
      reason: dto.reason,
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
    const [setting] = await this.database.db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

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
    const [setting] = await this.database.db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    return this.database.db
      .select()
      .from(settingAuditLogs)
      .where(eq(settingAuditLogs.settingId, setting.id))
      .orderBy(desc(settingAuditLogs.createdAt));
  }
}
