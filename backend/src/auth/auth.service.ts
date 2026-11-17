import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { isUUID } from 'class-validator';
import { UsersService } from '../users/users.service';
import { DatabaseService } from '../db/database.service';
import { users, refreshSessions, User } from '../db/schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshSessionService } from './services/refresh-session.service';

@Injectable()
export class AuthService {
  constructor(
    private database: DatabaseService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private refreshSessionService: RefreshSessionService,
    private usersService: UsersService,
  ) {}

  private parseExpirationToMs(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000; // default 15 minutes

    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 15 * 60 * 1000;
    }
  }

  private getAccessTokenExpiration(): string {
    return this.configService.get<string>('ACCESS_TOKEN_EXPIRATION', '15m');
  }

  private getRefreshTokenExpiration(): string {
    return this.configService.get<string>('REFRESH_TOKEN_EXPIRATION', '7d');
  }

  private getRefreshTokenExpirationMs(): number {
    return this.parseExpirationToMs(this.getRefreshTokenExpiration());
  }

  private issueTokens(user: Pick<User, 'id' | 'username' | 'role'>) {
    const sessionId = randomUUID();
    const payload = { sub: user.id, username: user.username, role: user.role, sid: sessionId };
    return {
      sessionId,
      access_token: this.jwtService.sign({ ...payload, token_use: 'access' }, { jwtid: randomUUID() }),
      refresh_token: this.jwtService.sign({ ...payload, token_use: 'refresh' }, {
        expiresIn: this.getRefreshTokenExpiration() as any, jwtid: randomUUID(),
      }),
      expiresAt: new Date(Date.now() + this.getRefreshTokenExpirationMs()),
    };
  }

  async login(loginDto: LoginDto) {
    return this.database.db.transaction(async tx => {
      // A role/password/deactivation change must either precede login or revoke its new session.
      const [user] = await tx.select().from(users).where(eq(users.username, loginDto.username)).limit(1).for('share');
      if (!user?.isActive || !await bcrypt.compare(loginDto.password, user.password)) {
        throw new UnauthorizedException('Invalid credentials');
      }
      const pair = this.issueTokens(user);
      await this.refreshSessionService.createSession(user.id, pair.refresh_token, pair.expiresAt, pair.sessionId, tx);
      return {
        access_token: pair.access_token, refresh_token: pair.refresh_token,
        user: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role },
      };
    });
  }

  async register(registerDto: RegisterDto, actorId: string) {
    const user = await this.usersService.create(registerDto, actorId);
    return { user, message: 'Registration successful' };
  }

  async logout(sessionId: string, userId: string) {
    await this.refreshSessionService.revokeSessionById(sessionId, userId);
    return { message: 'Logged out successfully' };
  }

  async refreshAccessToken(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token is expired. Please log in again.');
    }
    // Legacy refresh tokens are accepted through their existing database record.
    if (!isUUID(payload.sub) || (payload.token_use && payload.token_use !== 'refresh')) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.database.db.transaction(async tx => {
      const [user] = await tx.select().from(users).where(eq(users.id, payload.sub)).limit(1).for('share');
      if (!user?.isActive) throw new UnauthorizedException('User account is inactive');
      const pair = this.issueTokens(user);
      await this.refreshSessionService.rotateSession(refreshToken, user.id, pair, tx);
      return { access_token: pair.access_token, refresh_token: pair.refresh_token };
    });
  }

  async validateUser(userId: string) {
    const [user] = await this.database.db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user?.isActive) throw new UnauthorizedException('User account is inactive');
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Current password and new password are required');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }

    return this.database.db.transaction(async tx => {
      const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1).for('update');
      if (!user?.isActive) throw new UnauthorizedException('User account is inactive');
      if (!await bcrypt.compare(currentPassword, user.password)) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      const password = await bcrypt.hash(newPassword, 10);
      await tx.update(users).set({ password, updatedAt: new Date() }).where(eq(users.id, userId));
      await tx.update(refreshSessions).set({ revokedAt: new Date() })
        .where(and(eq(refreshSessions.userId, userId), isNull(refreshSessions.revokedAt)));
      return { message: 'Password changed successfully. Please log in again.' };
    });
  }
}
