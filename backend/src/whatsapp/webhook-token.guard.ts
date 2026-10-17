import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class WebhookTokenGuard implements CanActivate {
  constructor(private config: ConfigService, private settings: SettingsService) {}

  async configuredToken(): Promise<string> {
    const stored = await this.settings.getSettingForUse('gupshupWebhookToken').catch(error => {
      if (error?.getStatus?.() === 404) return '';
      throw error;
    });
    return stored || this.config.get<string>('GUPSHUP_WEBHOOK_TOKEN') || '';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const expected = await this.configuredToken();
    if (!expected) throw new ServiceUnavailableException('WhatsApp webhooks are not configured');
    const request = context.switchToHttp().getRequest();
    // Some providers can only configure a callback URL, without custom headers.
    const token = request.headers['x-webhook-token'] ?? request.query?.token;
    const digest = (value: string) => createHash('sha256').update(value).digest();
    if (typeof token !== 'string' || !timingSafeEqual(digest(token), digest(expected))) {
      throw new UnauthorizedException('Invalid webhook token');
    }
    return true;
  }
}
