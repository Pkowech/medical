import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

type RedisConfig = Pick<
  RedisOptions,
  | 'host'
  | 'port'
  | 'db'
  | 'username'
  | 'password'
  | 'maxRetriesPerRequest'
  | 'retryStrategy'
  | 'enableOfflineQueue'
>;

export function buildRedisOptions(configService: ConfigService): RedisOptions {
  const redisConfig = configService.get<RedisConfig>('redis') ?? {};
  const connectionOptions: RedisOptions = {
    maxRetriesPerRequest: redisConfig.maxRetriesPerRequest ?? 3,
    retryStrategy: redisConfig.retryStrategy,
    enableOfflineQueue: redisConfig.enableOfflineQueue ?? true,
  };
  const url = configService.get<string>('REDIS_URL');

  if (!url) {
    return {
      ...connectionOptions,
      host: redisConfig.host || 'redis',
      port: redisConfig.port || 6379,
      db: redisConfig.db ?? 0,
      username: redisConfig.username,
      password: redisConfig.password,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid REDIS_URL; expected a redis:// or rediss:// URL');
  }

  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new Error('Invalid REDIS_URL scheme; expected redis:// or rediss://');
  }
  if (!parsed.hostname) {
    throw new Error('REDIS_URL must include a Redis server hostname');
  }
  if (parsed.host.includes(',')) {
    throw new Error(
      'REDIS_URL supports one Redis endpoint; Sentinel requires dedicated configuration and is not supported by REDIS_URL',
    );
  }
  if (parsed.search || parsed.hash) {
    throw new Error(
      'REDIS_URL query strings and fragments are not supported; configure Redis options separately',
    );
  }

  const dbPath = parsed.pathname.replace(/^\/+/, '');
  if (dbPath && !/^\d+$/.test(dbPath)) {
    throw new Error(
      'REDIS_URL path must contain only a numeric Redis database',
    );
  }
  const db = dbPath ? Number(dbPath) : 0;
  if (!Number.isSafeInteger(db)) {
    throw new Error('REDIS_URL database number is out of range');
  }

  try {
    const hostname =
      parsed.hostname.startsWith('[') && parsed.hostname.endsWith(']')
        ? parsed.hostname.slice(1, -1)
        : parsed.hostname;
    return {
      ...connectionOptions,
      host: hostname,
      port: parsed.port ? Number(parsed.port) : 6379,
      db,
      username: parsed.username
        ? decodeURIComponent(parsed.username)
        : undefined,
      password: parsed.password
        ? decodeURIComponent(parsed.password)
        : undefined,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  } catch {
    throw new Error('Invalid percent-encoding in REDIS_URL credentials');
  }
}

export default buildRedisOptions;
