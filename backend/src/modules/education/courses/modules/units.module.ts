import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../infrastructure/prisma/prisma.module';
import { RedisModule } from '../../../../infrastructure/redis/redis.module';
import { AuthModule } from '../../../auth/auth.module'; // Added AuthModule import
import { CoursesModule } from './courses.module';

import { UnitsService } from '../services/units.service';
import { UnitsController } from '../controllers/units.controller';


@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    CoursesModule,
  ],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
