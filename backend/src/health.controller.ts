import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DatabaseService } from './db/database.service';
import { sql } from 'drizzle-orm';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private database: DatabaseService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  async check() {
    const checks: Record<string, string> = {};
    let healthy = true;

    try {
      await this.database.db.execute(sql`SELECT 1`);
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
      healthy = false;
    }

    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);

    return {
      status: healthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      checks,
      memory: {
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${heapTotalMB}MB`,
        rss: `${rssMB}MB`,
      },
      node: process.version,
    };
  }
}
