import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import KeyvRedis from '@keyv/redis';

export const redisCacheModule = CacheModule.registerAsync({
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const enableRedis =
      process.env.ENABLE_REDIS === 'true' || Boolean(process.env.REDIS_URL);

    const ttl = configService.get<number>('REDIS_CACHE_TTL', 3600);
    const max = configService.get<number>('REDIS_CACHE_MAX', 100);

    if (!enableRedis) {
      return { ttl, max };
    }

    const redisUrl = configService.get<string>('REDIS_URL');

    // Support both URL (Upstash/cloud) and host/port/password (self-hosted)
    // cache-manager v6 uses Keyv as the store abstraction
    const connectionString = redisUrl
      ? redisUrl
      : `redis://${configService.get('redis.password') ? `:${configService.get('redis.password')}@` : ''}${configService.get('redis.host', 'localhost')}:${configService.get('redis.port', 6379)}/${configService.get('redis.db', 0)}`;

    return {
      stores: [new KeyvRedis(connectionString)],
      ttl,
      max,
    };
  },
  isGlobal: true,
});