import { BadRequestException, Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { existsSync } from 'fs';
import { basename, extname, join } from 'path';
import { LOGO_TYPES } from './settings/logo-file';
import { Public } from './auth/decorators/public.decorator';

@ApiTags('Public Logo')
@Controller()
export class LogoController {
  @Get(['/logo/:filename', '/api/v1/logo/:filename'])
  @Public()
  @ApiOperation({ summary: 'Serve a company logo publicly' })
  async getLogo(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = basename(filename);
    const filePath = join(process.cwd(), 'uploads', 'logos', safeName);

    const mime = LOGO_TYPES[extname(safeName).toLowerCase()];
    if (!mime || safeName !== filename || !existsSync(filePath)) {
      throw new BadRequestException('Logo not found');
    }

    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.sendFile(filePath);
  }
}
