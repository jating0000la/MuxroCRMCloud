import { Controller, Post, Body, Get, UseGuards, Request, Response } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { StrictThrottle } from '../common/decorators/strict-throttle.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { ConfigService } from '@nestjs/config';

function parseExpirationToMs(expiration: string): number {
  const match = expiration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

const COOKIE_OPTIONS = (maxAgeMs: number, isProduction: boolean) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  maxAge: maxAgeMs,
  path: '/',
});

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private tokenBlacklist: TokenBlacklistService,
    private configService: ConfigService,
  ) {}

  @Post('login')
  @StrictThrottle()
  @ApiOperation({ summary: 'Login with username and password' })
  async login(@Body() loginDto: LoginDto, @Response() res) {
    const result = await this.authService.login(loginDto);
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const accessExpiration = this.configService.get<string>('ACCESS_TOKEN_EXPIRATION', '15m');
    const refreshExpiration = this.configService.get<string>('REFRESH_TOKEN_EXPIRATION', '7d');
    const accessMaxAge = parseExpirationToMs(accessExpiration);
    const refreshMaxAge = parseExpirationToMs(refreshExpiration);

    // Access token: short-lived HttpOnly cookie (15-30 min)
    res.cookie('auth_token', result.access_token, COOKIE_OPTIONS(accessMaxAge, isProduction));
    // Refresh token: long-lived HttpOnly cookie (7-30 days)
    res.cookie('refresh_token', result.refresh_token, COOKIE_OPTIONS(refreshMaxAge, isProduction));
    return res.json({ user: result.user, message: 'Login successful' });
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using HttpOnly refresh token cookie' })
  async refresh(@Request() req, @Response() res) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token found. Please log in again.' });
    }

    const result = await this.authService.refreshAccessToken(refreshToken);
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const accessExpiration = this.configService.get<string>('ACCESS_TOKEN_EXPIRATION', '15m');
    const refreshExpiration = this.configService.get<string>('REFRESH_TOKEN_EXPIRATION', '7d');
    const accessMaxAge = parseExpirationToMs(accessExpiration);
    const refreshMaxAge = parseExpirationToMs(refreshExpiration);

    // Rotate both cookies
    res.cookie('auth_token', result.access_token, COOKIE_OPTIONS(accessMaxAge, isProduction));
    res.cookie('refresh_token', result.refresh_token, COOKIE_OPTIONS(refreshMaxAge, isProduction));
    return res.json({ message: 'Token refreshed successfully' });
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register new user (Admin only)' })
  async register(@Body() registerDto: RegisterDto, @Response() res) {
    const result = await this.authService.register(registerDto);
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const accessExpiration = this.configService.get<string>('ACCESS_TOKEN_EXPIRATION', '15m');
    const refreshExpiration = this.configService.get<string>('REFRESH_TOKEN_EXPIRATION', '7d');
    const accessMaxAge = parseExpirationToMs(accessExpiration);
    const refreshMaxAge = parseExpirationToMs(refreshExpiration);

    res.cookie('auth_token', result.access_token, COOKIE_OPTIONS(accessMaxAge, isProduction));
    res.cookie('refresh_token', result.refresh_token, COOKIE_OPTIONS(refreshMaxAge, isProduction));
    return res.json({ user: result.user, message: 'Registration successful' });
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req) {
    return this.authService.validateUser(req.user.id);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke current token' })
  async logout(@Request() req, @Response() res) {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      await this.tokenBlacklist.revoke(refreshToken);
    }
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    // Clear both cookies
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
    return res.json({ message: 'Logged out successfully' });
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change current user password' })
  async changePassword(
    @Request() req,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    if (!body.currentPassword || !body.newPassword) {
      return { success: false, message: 'currentPassword and newPassword are required' };
    }
    if (body.newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters' };
    }
    return this.authService.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }
}
