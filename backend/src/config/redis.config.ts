import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => {
  // Read Redis values directly from environment. Defaults and validation
  // are handled by the global config validation schema so this file
  // should not invent alternate defaults — `.env` is the source of truth.
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT
    ? parseInt(process.env.REDIS_PORT, 10)
    : undefined;
  const password = process.env.REDIS_PASSWORD;
  const db = process.env.REDIS_DB
    ? parseInt(process.env.REDIS_DB, 10)
    : undefined;

  return {
    host,
    port,
    password,
    db,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'medtrack:',
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
  };
});
