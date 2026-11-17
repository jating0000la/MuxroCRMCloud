import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { BackupMaintenanceService } from './backup-maintenance.service';

@Injectable()
export class BackupMaintenanceMiddleware implements NestMiddleware {
  constructor(private readonly maintenance: BackupMaintenanceService) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'GET' && req.originalUrl.split('?')[0] === '/api/v1/health') return next();
    if (this.maintenance.restoring) {
      return res.status(503).json({ statusCode: 503, message: 'Database restore is in progress. Try again after it completes.' });
    }
    this.maintenance.activeRequests++;
    let finished = false;
    const release = () => {
      if (!finished) { finished = true; this.maintenance.activeRequests--; }
    };
    res.once('finish', release);
    res.once('close', release);
    next();
  }
}
