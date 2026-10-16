import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SettingsService } from './settings.service';

@Controller('branding')
@UseGuards(JwtAuthGuard)
export class BrandingController {
  constructor(private settings: SettingsService) {}

  @Get()
  getBranding() {
    return this.settings.getBranding();
  }
}
