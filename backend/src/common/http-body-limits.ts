import { INestApplication } from '@nestjs/common';
import { json, urlencoded } from 'express';

export function configureBodyLimits(app: INestApplication) {
  // Four MiB files expand to ~5.4 MiB when encoded in a public-form JSON body.
  app.use('/api/v1/integrations/cloudconnect/webhook', urlencoded({ extended: false, limit: '32kb', parameterLimit: 50 }));
  app.use('/api/v1/forms/public', json({ limit: '8mb' }));
  app.use(json({ limit: '1mb' }));
}
