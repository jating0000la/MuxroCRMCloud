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
import { ExtractJwt } from 'passport-jwt';

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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private tokenBlacklist: TokenBlacklistService,
  ) {}

  @Post('login')
  @StrictThrottle()
  @ApiOperation({ summary: 'Login with username and password' })
  async login(@Body() loginDto: LoginDto, @Response() res) {
    const result = await this.authService.login(loginDto);
    const maxAge = parseExpirationToMs(process.env.JWT_EXPIRATION || '7d');
    res.cookie('auth_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
      path: '/',
    });
    return res.json({ user: result.user, message: 'Login successful' });
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register new user (Admin only)' })
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);
    return { user: result.user, message: 'Registration successful' };
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
    let token = ExtractJwt.fromAuthHeaderAsBearerToken()(req) || req.cookies?.auth_token;
    if (token) {
      await this.tokenBlacklist.revoke(token);
    }
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
    return this.authService.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }
}
