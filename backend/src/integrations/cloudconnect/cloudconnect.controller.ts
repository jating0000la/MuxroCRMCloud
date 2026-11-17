import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CloudConnectService } from './cloudconnect.service';
import { CloudConnectConfigDto, IvrListQueryDto } from './cloudconnect.dto';

@Controller('integrations/cloudconnect')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CloudConnectController {
  constructor(private service: CloudConnectService) {}
  @Get('config') @Roles('ADMIN') getConfig() { return this.service.getConfig(); }
  @Put('config') @Roles('ADMIN') save(@Body() dto: CloudConnectConfigDto, @Req() req: any) { return this.service.saveConfig(dto, req.user.id); }
  @Post('webhook-token') @Roles('ADMIN') token(@Req() req: any) { return this.service.rotateToken(req.user.id); }
  @Get('calls') calls(@Query() query: IvrListQueryDto, @Req() req: any) { return this.service.listCalls(query, req.user.id, req.user.role); }
  @Get('events') @Roles('ADMIN') events(@Query() query: IvrListQueryDto) { return this.service.listEvents(query); }
  @Post('events/:id/retry') @Roles('ADMIN') @HttpCode(202)
  retry(@Param('id', ParseUUIDPipe) id: string) { return this.service.retryEvent(id); }
}

@Controller('integrations/cloudconnect/webhook')
export class CloudConnectWebhookController {
  constructor(private service: CloudConnectService) {}
  // Provider documentation shows URL parameters. Support those and form/JSON POST bodies.
  @Get() @HttpCode(202) @Throttle({ default: { limit: 600, ttl: 60000 } })
  get(@Req() req: Request) { return this.receive(req, req.query); }
  @Post() @HttpCode(202) @Throttle({ default: { limit: 600, ttl: 60000 } })
  post(@Req() req: Request) { return this.receive(req, req.body); }
  private receive(req: Request, body: unknown) {
    const token = req.headers['x-cloudconnect-token'] || req.query.token;
    return this.service.receive(body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}, typeof token === 'string' ? token : '');
  }
}
