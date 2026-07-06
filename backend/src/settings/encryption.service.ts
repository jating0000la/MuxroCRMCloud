import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly encryptionKey: Buffer;
  private readonly encryptionSalt: string;

  constructor() {
    // Encryption key is MANDATORY - throw error if not set
    const keyString = process.env.APP_ENCRYPTION_KEY;
    if (!keyString) {
      throw new Error(
        'APP_ENCRYPTION_KEY environment variable is required.\n' +
        'Generate with: openssl rand -base64 32\n' +
        'Add to .env: APP_ENCRYPTION_KEY=<generated-key>'
      );
    }

    // Salt is also mandatory for key derivation
    this.encryptionSalt = process.env.ENCRYPTION_SALT || 'default-salt';
    if (this.encryptionSalt === 'default-salt') {
      console.warn('⚠️  WARNING: Using default ENCRYPTION_SALT. Set ENCRYPTION_SALT in .env for production.');
    }

    // Derive 32-byte key from string using scrypt
    this.encryptionKey = scryptSync(keyString, this.encryptionSalt, 32);
  }

  encrypt(plaintext: string): string {
    try {
      const iv = randomBytes(16);
      const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV + authTag + encrypted data
      const combined = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
      return combined;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  decrypt(encryptedData: string): string {
    try {
      const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
      
      if (!ivHex || !authTagHex || !encrypted) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);
      
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  maskValue(value: string, showChars: number = 4): string {
    if (value.length <= showChars) {
      return value;
    }
    const lastChars = value.slice(-showChars);
    const maskLength = value.length - showChars;
    return '•'.repeat(maskLength) + lastChars;
  }
}
