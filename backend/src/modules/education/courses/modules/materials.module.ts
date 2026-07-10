import { Module } from '@nestjs/common';
import { PrismaModule } from '#infrastructure/prisma/prisma.module';
import { RedisModule } from '#infrastructure/redis/redis.module';
import { StorageModule } from '#infrastructure/storage/storage.module';
import { MaterialsService } from '../services/materials.service';
import { DirectoryIngestionService } from '../services/directory-ingestion.service';
import { MaterialsController } from '../controllers/materials.controller';
import { MaterialListeners } from '../listeners/material.listeners';
import { AuthModule } from '../../../auth/auth.module';
import { LearningModule } from './learning.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    LearningModule,
    StorageModule,
  ],
  controllers: [MaterialsController],
  providers: [MaterialsService, MaterialListeners, DirectoryIngestionService],
  exports: [MaterialsService, DirectoryIngestionService],
})
export class MaterialsModule {}
