import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';

@Injectable()
export class WebhookTokenGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('GUPSHUP_WEBHOOK_TOKEN');
    if (!expected) throw new ServiceUnavailableException('WhatsApp webhooks are not configured');
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-webhook-token'];
    // Hash both sides to compare fixed-size buffers, including wrong-length tokens.
    const digest = (value: string) => createHash('sha256').update(value).digest();
    if (typeof token !== 'string' || !timingSafeEqual(digest(token), digest(expected))) {
      throw new UnauthorizedException('Invalid webhook token');
    }
    return true;
  }
}
