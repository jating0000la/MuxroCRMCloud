import { Throttle } from '@nestjs/throttler';

/**
 * Stricter rate limiting for sensitive endpoints (login, registration, etc.)
 * Allows only 5 requests per minute
 */
export const StrictThrottle = () => Throttle({ default: { limit: 5, ttl: 60000 } });
