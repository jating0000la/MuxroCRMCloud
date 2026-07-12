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

  private getExpirationMs(): number {
    const expiration = this.configService.get<string>('JWT_EXPIRATION', '7d');
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days

    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 7 * 24 * 60 * 60 * 1000;
    }
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
    const token = this.jwtService.sign(payload);

    // Create a DB-backed session (if this fails, revoke the token)
    try {
      const expiresAt = new Date(Date.now() + this.getExpirationMs());
      await this.refreshSessionService.createSession(user.id, token, expiresAt);
    } catch (sessionError) {
      await this.refreshSessionService.revokeSession(token);
      throw new UnauthorizedException('Login failed. Please try again.');
    }

    return {
      access_token: token,
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
    const token = this.jwtService.sign(payload);

    // Create a DB-backed session (if this fails, revoke the token)
    try {
      const expiresAt = new Date(Date.now() + this.getExpirationMs());
      await this.refreshSessionService.createSession(user.id, token, expiresAt);
    } catch (sessionError) {
      await this.refreshSessionService.revokeSession(token);
      throw new ConflictException('Registration failed. Please try again.');
    }

    return {
      access_token: token,
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
