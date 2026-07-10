import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

// Build a redis connection value usable by ioredis / bullmq
export function buildRedisOptions(
  configService: ConfigService,
): RedisOptions | string {
  // Prefer explicit REDIS_URL if provided
  const url = configService.get<string>('REDIS_URL');
  if (url) {
    // If the URL is for Redis Sentinel, ioredis can handle it directly
    // via a comma-separated list of hosts.
    if (url.includes(',')) {
      return url;
    }
    // Otherwise, parse the URL to handle credentials safely.
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : 6379,
        db: parsed.pathname
          ? parseInt(parsed.pathname.replace('/', ''), 10)
          : 0,
        username: parsed.username
          ? decodeURIComponent(parsed.username)
          : undefined,
        password: parsed.password
          ? decodeURIComponent(parsed.password)
          : undefined,
      };
    } catch (_e) {
      // Fallback for URLs that don't parse, though this is unlikely.
      return url;
    }
  }

  // Otherwise, use the `redis` config object (from redis.config)
  const redisConfig = configService.get<any>('redis') || {};
  return {
    host: redisConfig.host || 'redis',
    port: redisConfig.port || 6379,
    db: redisConfig.db ?? 0,
    username: redisConfig.username,
    password: redisConfig.password,
    // reasonable defaults
    maxRetriesPerRequest: redisConfig.maxRetriesPerRequest ?? 3,
    retryStrategy: redisConfig.retryStrategy,
  };
}

export default buildRedisOptions;
