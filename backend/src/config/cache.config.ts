import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { ConfigService } from '@nestjs/config';

export const redisCacheModule = CacheModule.registerAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const enableRedis = process.env.ENABLE_REDIS === 'true';
    const ttl = configService.get('REDIS_CACHE_TTL', 3600);
    const max = configService.get('REDIS_CACHE_MAX', 100);

    // If Redis is not explicitly enabled, return a plain in-memory cache
    // configuration to avoid creating a Redis connection during bootstrap.
    if (!enableRedis) {
      return {
        // Use Nest's default in-memory store
        ttl,
        max,
      };
    }

    const redisConfig = configService.get('redis');
    return {
      store: redisStore,
      ...redisConfig, // Spread the centralized redis config
      ttl,
      max,
    };
  },
});
