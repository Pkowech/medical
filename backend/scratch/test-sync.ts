
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GlobalSearchSyncService } from '../src/infrastructure/search/services/global-search-sync.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const syncService = app.get(GlobalSearchSyncService);
  
  console.log('Starting manual sync test...');
  await syncService.syncAll();
  console.log('Sync test completed!');
  
  await app.close();
}

bootstrap().catch(err => {
  console.error('Sync test failed:', err);
  process.exit(1);
});
