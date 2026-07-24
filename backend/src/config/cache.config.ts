import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { ConfigService } from '@nestjs/config';

export const redisCacheModule = CacheModule.registerAsync({
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const enableRedis = process.env.ENABLE_REDIS === 'true';

    const ttl = configService.get<number>('REDIS_CACHE_TTL', 3600);
    const max = configService.get<number>('REDIS_CACHE_MAX', 100);

    if (!enableRedis) {
      return {
        ttl,
        max,
      };
    }

    const redisUrl = process.env.REDIS_URL;

    return {
      store: await redisStore({
        url: redisUrl,
      }),
      ttl,
      max,
    };
  },
});