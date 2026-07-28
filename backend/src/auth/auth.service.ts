import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { users } from '../db/schema';
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

  async login(loginDto: LoginDto) {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.username, loginDto.username))
      .limit(1);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.getRefreshTokenExpiration() as any,
    });

    // Create a DB-backed session for the refresh token
    try {
      const expiresAt = new Date(Date.now() + this.getRefreshTokenExpirationMs());
      await this.refreshSessionService.createSession(user.id, refreshToken, expiresAt);
    } catch (sessionError) {
      // If createSession failed, there is no session to revoke — the user just needs to retry
      throw new UnauthorizedException('Login failed. Please try again.');
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const [existingUser] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.username, registerDto.username))
      .limit(1);

    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const [user] = await this.database.db
      .insert(users)
      .values({
        ...registerDto,
        password: hashedPassword,
      })
      .returning();

    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.getRefreshTokenExpiration() as any,
    });

    // Create a DB-backed session for the refresh token
    try {
      const expiresAt = new Date(Date.now() + this.getRefreshTokenExpirationMs());
      await this.refreshSessionService.createSession(user.id, refreshToken, expiresAt);
    } catch (sessionError) {
      // If createSession failed, there is no session to revoke
      throw new ConflictException('Registration failed. Please try again.');
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async logout(token: string) {
    await this.refreshSessionService.revokeSession(token);
    return { message: 'Logged out successfully' };
  }

  /**
   * Refresh access token using a valid refresh token.
   */
  async refreshAccessToken(refreshToken: string) {
    // Verify the refresh token is still valid (not revoked / expired)
    const isRevoked = await this.refreshSessionService.isRevoked(refreshToken);
    if (isRevoked) {
      throw new UnauthorizedException('Refresh token is invalid. Please log in again.');
    }

    // Decode the refresh token to get user info
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token is expired. Please log in again.');
    }

    // Issue new token pair
    const userPayload = { sub: payload.sub, username: payload.username, role: payload.role };
    const newAccessToken = this.jwtService.sign(userPayload);
    const newRefreshToken = this.jwtService.sign(userPayload, {
      expiresIn: this.getRefreshTokenExpiration() as any,
    });

    // Create new DB session FIRST — if this fails, the old token remains valid
    try {
      const expiresAt = new Date(Date.now() + this.getRefreshTokenExpirationMs());
      await this.refreshSessionService.createSession(payload.sub, newRefreshToken, expiresAt);
    } catch (sessionError) {
      // New session failed, old token stays valid — user can retry
      throw new UnauthorizedException('Token refresh failed. Please log in again.');
    }

    // Revoke old refresh token AFTER new session is safely created (atomic rotation)
    await this.refreshSessionService.revokeSession(refreshToken);

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
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
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Current password and new password are required');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }

    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.database.db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Revoke all sessions on password change for security
    await this.refreshSessionService.revokeAllUserSessions(userId);

    return { message: 'Password changed successfully. Please log in again.' };
  }
}
