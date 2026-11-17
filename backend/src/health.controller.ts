import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DatabaseService } from './db/database.service';
import { sql } from 'drizzle-orm';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private database: DatabaseService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  async check() {
    let dbStatus = 'ok';
    try {
      await this.database.db.execute(sql`SELECT 1`);
    } catch {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'ok' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      checks: { database: dbStatus },
    };
  }

  @Get('health/detailed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Detailed health check (Admin only)' })
  async detailedCheck() {
    let dbStatus = 'ok';
    try {
      await this.database.db.execute(sql`SELECT 1`);
    } catch {
      dbStatus = 'error';
    }

    const memUsage = process.memoryUsage();

    return {
      status: dbStatus === 'ok' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      checks: { database: dbStatus },
      memory: {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      },
      node: process.version,
    };
  }
}
