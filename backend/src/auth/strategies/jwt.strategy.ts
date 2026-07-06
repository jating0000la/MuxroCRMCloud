import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { TokenBlacklistService } from '../services/token-blacklist.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly tokenBlacklist: TokenBlacklistService,
  ) {
    super({
      // ✅ FIXED: Extract from both Bearer token AND httpOnly cookie
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
    });
  }

  async validate(req: any, payload: any) {
    // Extract token from request (Bearer or cookie) for blacklist check
    let token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (!token && req.cookies) {
      token = req.cookies.auth_token;
    }

    // Check if token has been revoked/blacklisted
    if (token && this.tokenBlacklist.isBlacklisted(token)) {
      throw new UnauthorizedException('Token has been revoked. Please log in again.');
    }

    return { id: payload.sub, username: payload.username, role: payload.role };
  }
}
