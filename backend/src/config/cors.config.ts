// src/config/cors.config.ts
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export const corsConfig: CorsOptions = {
  origin:
    process.env.NODE_ENV === 'production'
      ? ([process.env.FRONTEND_URL, process.env.ADMIN_URL].filter(
          Boolean,
        ) as string[])
      : true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
  ],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};
