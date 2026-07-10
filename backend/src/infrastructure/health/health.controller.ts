import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';
import { PrismaHealthIndicator } from './prisma.health';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaHealthIndicator,
    private redis: RedisHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  @Get()
  quick() {
    // Quick health check for container probes
    return { status: 'ok' };
  }

  @Get('full')
  @HealthCheck()
  check() {
    return this.health.check([
      // Database check
      () => this.prisma.isHealthy('database'),
      // Redis check
      () => this.redis.isHealthy('redis'),
      // Memory usage check - 200MB heap, 3GB RSS
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 3000 * 1024 * 1024),
      // Storage check - 90% threshold
      () =>
        this.disk.checkStorage('storage', {
          thresholdPercent: 0.9,
          path: process.platform === 'win32' ? 'C:\\' : '/',
        }),
    ]);
  }
}
