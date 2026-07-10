import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../infrastructure/prisma/prisma.module';
import { RedisModule } from '../../../../infrastructure/redis/redis.module';
import { CourseCategoriesService } from '../services/course-categories.service';
import { CourseCategoriesController } from '../controllers/course-categories.controller';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [CourseCategoriesController],
  providers: [CourseCategoriesService],
  exports: [CourseCategoriesService],
})
export class CourseCategoriesModule {}
