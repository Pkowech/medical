import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisHealthIndicator } from './redis.health';
import { PrismaHealthIndicator } from './prisma.health';

@Module({
  imports: [TerminusModule, PrismaModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, PrismaHealthIndicator],
})
export class HealthModule {}
