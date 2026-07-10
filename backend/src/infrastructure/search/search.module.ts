// src/modules/search/search.module.ts
import { Global, Module } from '@nestjs/common';
import { SearchController } from './controllers/search.controller';
import { SearchService } from './services/search.service';
import { SearchCacheService } from './services/search-cache.service';
import { GlobalSearchSyncService } from './services/global-search-sync.service';
import { MedicalSynonymService } from './services/medical-synonym.service';
import { PrismaModule } from '#infrastructure/prisma/prisma.module';
import { RedisModule } from '#infrastructure/redis/redis.module';

@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [SearchController],
  providers: [
    SearchService, 
    SearchCacheService,
    GlobalSearchSyncService,
    MedicalSynonymService,
  ],
  exports: [
    SearchService, 
    SearchCacheService,
    GlobalSearchSyncService,
    MedicalSynonymService,
  ],
})
export class SearchModule {}
