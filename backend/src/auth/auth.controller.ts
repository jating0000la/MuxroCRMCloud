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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private tokenBlacklist: TokenBlacklistService,
  ) {}

  @Post('login')
  @StrictThrottle()  // ✅ FIXED: Strict rate limit (5 per minute)
  @ApiOperation({ summary: 'Login with username and password' })
  async login(@Body() loginDto: LoginDto, @Response() res) {
    const result = await this.authService.login(loginDto);
    // ✅ FIXED: Set httpOnly cookie (secure=true in production, sameSite=strict)
    res.cookie('auth_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    // Return user info without token (token in httpOnly cookie)
    return res.json({ user: result.user, message: 'Login successful' });
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register new user (Admin only)' })
  async register(@Body() registerDto: RegisterDto, @Response() res) {
    const result = await this.authService.register(registerDto);
    // ✅ FIXED: Set httpOnly cookie for new user
    res.cookie('auth_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
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
    // Extract token from Authorization header (fallback) or cookie
    let token = ExtractJwt.fromAuthHeaderAsBearerToken()(req) || req.cookies?.auth_token;
    if (token) {
      // Add token to blacklist (TTL: 24 hours)
      this.tokenBlacklist.revoke(token, 24 * 60 * 60);
    }
    // ✅ FIXED: Clear httpOnly cookie
    res.clearCookie('auth_token');
    return res.json({ message: 'Logged out successfully' });
  }
}
