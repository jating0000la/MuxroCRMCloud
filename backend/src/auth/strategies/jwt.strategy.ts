import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { TokenBlacklistService } from '../services/token-blacklist.service';

// Simple TTL cache for session validation (reduces DB hits from every HTTP request)
const sessionCache = new Map<string, { valid: boolean; expires: number }>();
const SESSION_CACHE_TTL = 60_000; // 1 minute
const MAX_CACHE_SIZE = 1000;

// Periodic cache eviction to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of sessionCache) {
    if (val.expires < now) sessionCache.delete(key);
  }
  // Hard cap: if still too large, evict oldest half
  if (sessionCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(sessionCache.entries());
    for (let i = 0; i < entries.length / 2; i++) {
      sessionCache.delete(entries[i][0]);
    }
  }
}, 300_000); // every 5 minutes

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly tokenBlacklist: TokenBlacklistService,
  ) {
    super({
      jwtFromRequest: (req) => {
        let token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        if (!token && req.cookies) {
          token = req.cookies.auth_token;
        }
        return token;
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: true,
    } as StrategyOptionsWithRequest);
  }

  async validate(req: any, payload: any) {
    let token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (!token && req.cookies) {
      token = req.cookies.auth_token;
    }

    // Check cache first to avoid DB hit on every request
    if (token) {
      const cached = sessionCache.get(token);
      if (cached) {
        if (!cached.valid) {
          throw new UnauthorizedException('Token has been revoked. Please log in again.');
        }
        // Cache hit, valid session
      } else {
        // Cache miss, check DB
        const isRevoked = await this.tokenBlacklist.isBlacklisted(token);
        sessionCache.set(token, { valid: !isRevoked, expires: Date.now() + SESSION_CACHE_TTL });
        if (isRevoked) {
          throw new UnauthorizedException('Token has been revoked. Please log in again.');
        }
      }
    }

    return { id: payload.sub, username: payload.username, role: payload.role };
  }
}
