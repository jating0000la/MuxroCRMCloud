import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GupshupTemplatesService } from './gupshup-templates.service';
@Controller('integrations/gupshup/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'USER')
export class GupshupTemplatesController {
  constructor(private templates: GupshupTemplatesService) {}
  @Get() list() { return this.templates.list(); }
}
