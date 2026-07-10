import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../infrastructure/prisma/prisma.module';
import { RedisModule } from '../../../../infrastructure/redis/redis.module';
import { AuthModule } from '../../../auth/auth.module'; // Added AuthModule import

import { ClinicalCasesService } from '../services/clinical-cases.service';
import { ClinicalCasesController } from '../controllers/clinical-cases.controller';


@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
  ],
  controllers: [ClinicalCasesController],
  providers: [ClinicalCasesService],
  exports: [ClinicalCasesService],
})
export class ClinicalCasesModule {}
