// src/config/throttler.config.ts
import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerConfig: ThrottlerModuleOptions = [
  {
    name: 'default',
    ttl: 60000, // 1 minute
    limit: 100, // 100 requests per minute
  },
  {
    name: 'auth',
    ttl: 900000, // 15 minutes
    limit: 5, // 5 login attempts per 15 minutes
  },
  {
    name: 'upload',
    ttl: 60000, // 1 minute
    limit: 10, // 10 uploads per minute
  },
];
