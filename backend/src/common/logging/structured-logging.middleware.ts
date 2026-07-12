import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class StructuredLoggingMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl, ip } = req;
    const userAgent = req.headers['user-agent'] || 'unknown';

    const originalJson = res.json.bind(res);
    let responseBody: any;

    res.json = (body: any) => {
      responseBody = body;
      return originalJson(body);
    };

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const userId = (req as any).user?.id;
      const requestId = req.headers['x-request-id'] as string;

      const logEntry = {
        timestamp: new Date().toISOString(),
        method,
        url: originalUrl,
        status: statusCode,
        duration: `${duration}ms`,
        ip: ip || req.socket.remoteAddress,
        userAgent,
        userId,
        requestId,
      };

      if (statusCode >= 500) {
        this.logger.error(JSON.stringify(logEntry));
      } else if (statusCode >= 400) {
        this.logger.warn(JSON.stringify(logEntry));
      } else {
        this.logger.log(JSON.stringify(logEntry));
      }
    });

    next();
  }
}
