import { BadRequestException, Controller, Get, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const retentionMs = 24 * 60 * 60 * 1000;
const tokenPattern = /^(\d{13})-[0-9a-f-]{36}$/;
const attachmentDirectory = () => path.resolve(process.env.WHATSAPP_UPLOAD_DIR || 'uploads/whatsapp');
const storage = diskStorage({
  destination: (_req, _file, callback) => {
    try {
      const directory = attachmentDirectory();
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      callback(null, directory);
    } catch (error) { callback(error as Error, ''); }
  },
  filename: (_req, _file, callback) => callback(null, `${Date.now()}-${randomUUID()}`),
});

@Injectable()
export class AttachmentCleanup implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private logger = new Logger(AttachmentCleanup.name);

  onModuleInit() {
    void this.clean();
    this.timer = setInterval(() => void this.clean(), 60000);
    this.timer.unref();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async clean() {
    if (this.running) return;
    this.running = true;
    try {
      const directory = attachmentDirectory();
      const files = await fs.promises.readdir(directory).catch((error) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      });
      for (const file of files) {
        const match = tokenPattern.exec(file);
        if (match && Date.now() >= Number(match[1]) + retentionMs) {
          await fs.promises.rm(path.join(directory, file), { force: true });
        }
      }
    } catch { this.logger.error('WhatsApp attachment cleanup failed. Check storage permissions.'); }
    finally { this.running = false; }
  }
}

@Controller('whatsapp/attachments')
export class AttachmentsController {
  constructor(private config: ConfigService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  @UseInterceptors(FileInterceptor('file', {
    storage, limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 0 },
  }))
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Choose a file.');
    try {
      const base = this.config.get<string>('PUBLIC_BASE_URL');
      if (!base) throw new BadRequestException('Configure PUBLIC_BASE_URL with the public HTTPS address of this CRM before uploading attachments.');
      const url = new URL(base);
      if (url.protocol !== 'https:' || url.username || url.password) {
        throw new BadRequestException('PUBLIC_BASE_URL must be a public HTTPS address.');
      }
      const name = path.basename(file.originalname).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 180) || 'attachment';
      return {
        url: new URL(`/api/v1/whatsapp/attachments/${file.filename}/${encodeURIComponent(name)}`, url.origin).toString(),
        filename: name, size: file.size,
        expiresAt: new Date(Number(file.filename.slice(0, 13)) + retentionMs).toISOString(),
      };
    } catch (error) {
      await fs.promises.rm(file.path, { force: true });
      throw error;
    }
  }

  @Get(':token/:filename')
  async download(@Param('token') token: string, @Param('filename') filename: string, @Res() res: Response) {
    const match = tokenPattern.exec(token);
    if (!match || Date.now() >= Number(match[1]) + retentionMs) {
      throw new NotFoundException('This attachment has expired or is unavailable.');
    }
    const filepath = path.join(attachmentDirectory(), token);
    const stats = await fs.promises.lstat(filepath).catch(() => null);
    if (!stats?.isFile() || stats.isSymbolicLink()) throw new NotFoundException('Attachment unavailable.');
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox" });
    // Use sendFile instead of download to avoid Content-Disposition: attachment header
    // This allows WhatsApp/Gupshup to fetch the media inline
    res.sendFile(filepath, (error) => {
      if (error && !res.headersSent) res.status(404).end();
    });
  }
}
