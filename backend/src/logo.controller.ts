import { BadRequestException, Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { existsSync } from 'fs';
import { basename, join } from 'path';
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

    if (!existsSync(filePath)) {
      throw new BadRequestException('Logo not found');
    }

    res.sendFile(filePath);
  }
}
