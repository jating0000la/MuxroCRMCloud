import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { TokenBlacklistService } from '../services/token-blacklist.service';

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

    // Check if token has been revoked in the database
    if (token) {
      const isRevoked = await this.tokenBlacklist.isBlacklisted(token);
      if (isRevoked) {
        throw new UnauthorizedException('Token has been revoked. Please log in again.');
      }
    }

    return { id: payload.sub, username: payload.username, role: payload.role };
  }
}
