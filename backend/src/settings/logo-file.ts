import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
};

export function validateLogo(file: Express.Multer.File): string {
  const extension = extname(file.originalname).toLowerCase();
  const bytes = file.buffer;
  const mime = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
  const png = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (bytes.length > MAX_LOGO_BYTES || !LOGO_TYPES[extension] || LOGO_TYPES[extension] !== mime ||
      !(extension === '.png' ? png : extension === '.webp' ? webp : jpeg)) {
    throw new BadRequestException('Upload a PNG, JPEG, or WebP image up to 2 MB with a matching file extension');
  }
  return extension;
}
