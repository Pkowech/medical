
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../src/infrastructure/prisma/prisma.module';
import { RedisModule } from '../src/infrastructure/redis/redis.module';
import { GlobalSearchSyncService } from '../src/infrastructure/search/services/global-search-sync.service';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [GlobalSearchSyncService],
})
class TestModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(TestModule);
  const syncService = app.get(GlobalSearchSyncService);
  
  console.log('Starting minimal sync test...');
  // We can't call syncAll because it depends on other models that might not be in this minimal context
  // But we can check if the service is instantiated
  console.log('GlobalSearchSyncService instantiated successfully!');
  
  await app.close();
}

bootstrap().catch(err => {
  console.error('Minimal sync test failed:', err);
  process.exit(1);
});
