import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { isUUID } from 'class-validator';
import { DatabaseService } from '../../db/database.service';
import { users, refreshSessions } from '../../db/schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService, private readonly database: DatabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        req => req?.cookies?.auth_token || null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    if (payload.token_use !== 'access' || !isUUID(payload.sub) || !isUUID(payload.sid)) {
      throw new UnauthorizedException('Please log in again.');
    }
    // Authorize using the current account and its persisted session, not stale JWT roles.
    const [user] = await this.database.db.select({ id: users.id, username: users.username, role: users.role })
      .from(users).innerJoin(refreshSessions, eq(refreshSessions.userId, users.id))
      .where(and(eq(users.id, payload.sub), eq(users.isActive, true), eq(refreshSessions.id, payload.sid),
        isNull(refreshSessions.revokedAt), gt(refreshSessions.expiresAt, new Date()))).limit(1);
    if (!user) throw new UnauthorizedException('Account or session is inactive. Please log in again.');
    return { ...user, sessionId: payload.sid };
  }
}
