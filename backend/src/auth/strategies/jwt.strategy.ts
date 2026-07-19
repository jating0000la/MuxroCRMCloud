import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { TokenBlacklistService } from '../services/token-blacklist.service';

/**
 * Access tokens are short-lived (15 min) and NOT stored in DB.
 * We use an in-memory blacklist for explicit revocation (logout, password change).
 * Tokens naturally expire via JWT `exp` claim.
 */
const accessTokenBlacklist = new Map<string, number>(); // token -> expiry timestamp
const MAX_CACHE_SIZE = 1000;

// Periodic cleanup to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of accessTokenBlacklist) {
    if (val < now) accessTokenBlacklist.delete(key);
  }
  if (accessTokenBlacklist.size > MAX_CACHE_SIZE) {
    const entries = Array.from(accessTokenBlacklist.entries());
    for (let i = 0; i < entries.length / 2; i++) {
      accessTokenBlacklist.delete(entries[i][0]);
    }
  }
}, 300_000); // every 5 minutes

/** Exported for use by logout / password-change endpoints */
export function revokeAccessToken(token: string): void {
  // Store with 15 min TTL (matches max access token lifetime)
  accessTokenBlacklist.set(token, Date.now() + 15 * 60 * 1000);
}

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

    if (token) {
      // Check in-memory blacklist first (instant, for logout/password change)
      const blacklisted = accessTokenBlacklist.get(token);
      if (blacklisted) {
        if (blacklisted > Date.now()) {
          throw new UnauthorizedException('Token has been revoked. Please log in again.');
        }
        accessTokenBlacklist.delete(token); // expired entry, clean up
      }
    }

    return { id: payload.sub, username: payload.username, role: payload.role };
  }
}
