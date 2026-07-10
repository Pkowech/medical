import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '#infrastructure/redis/redis.service';
import { Role } from '../constants/role.constants';

interface RateLimitConfig {
  points: number;
  duration: number;
  blockDuration: number;
}

@Injectable()
export class RoleLimitingService {
  private readonly logger = new Logger(RoleLimitingService.name);
  private readonly prefix = 'rateLimit:';
  private readonly limits: Map<Role, Record<string, RateLimitConfig>>;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    // Load default limits from configuration or fallback to hardcoded values
    this.limits = new Map<Role, Record<string, RateLimitConfig>>([
      [
        Role.admin,
        {
          api: this.configService.get('rateLimits.admin.api') || {
            points: 1000,
            duration: 60,
            blockDuration: 300,
          },
          auth: this.configService.get('rateLimits.admin.auth') || {
            points: 20,
            duration: 60,
            blockDuration: 600,
          },
          medical: this.configService.get('rateLimits.admin.medical') || {
            points: 200,
            duration: 60,
            blockDuration: 300,
          },
        },
      ],
      [
        Role.moderator,
        {
          api: this.configService.get('rateLimits.moderator.api') || {
            points: 500,
            duration: 60,
            blockDuration: 300,
          },
          auth: this.configService.get('rateLimits.moderator.auth') || {
            points: 10,
            duration: 60,
            blockDuration: 600,
          },
          medical: this.configService.get('rateLimits.moderator.medical') || {
            points: 150,
            duration: 60,
            blockDuration: 300,
          },
        },
      ],
      [
        Role.instructor,
        {
          api: this.configService.get('rateLimits.instructor.api') || {
            points: 300,
            duration: 60,
            blockDuration: 300,
          },
          auth: this.configService.get('rateLimits.instructor.auth') || {
            points: 10,
            duration: 60,
            blockDuration: 600,
          },
          medical: this.configService.get('rateLimits.instructor.medical') || {
            points: 100,
            duration: 60,
            blockDuration: 300,
          },
        },
      ],
      [
        Role.student,
        {
          api: this.configService.get('rateLimits.student.api') || {
            points: 100,
            duration: 60,
            blockDuration: 300,
          },
          auth: this.configService.get('rateLimits.student.auth') || {
            points: 5,
            duration: 60,
            blockDuration: 600,
          },
          medical: this.configService.get('rateLimits.student.medical') || {
            points: 20,
            duration: 60,
            blockDuration: 300,
          },
        },
      ],
    ]);
  }

  private getKey(userId: string, endpointType: string): string {
    return `${this.prefix}${userId}:${endpointType}`;
  }

  private getBlockKey(userId: string, endpointType: string): string {
    return `${this.prefix}${userId}:${endpointType}:blocked`;
  }

  async isRateLimited(
    userId: string,
    role: Role,
    endpointType: string,
  ): Promise<boolean> {
    const blockKey = this.getBlockKey(userId, endpointType);
    const isBlocked = await this.redisService.exists(blockKey);
    if (isBlocked) {
      this.logger.warn(`User ${userId} is blocked for ${endpointType}`);
      return true;
    }

    const key = this.getKey(userId, endpointType);
    const config = this.limits.get(role)?.[endpointType];
    if (!config) {
      this.logger.warn(
        `No rate limit config for role ${role} and endpoint ${endpointType}`,
      );
      return false;
    }

    const current = await this.redisService.increment(key);
    if (current === 1) {
      await this.redisService.expire(key, config.duration);
    }

    if (current > config.points) {
      await this.redisService.set(blockKey, 'blocked', config.blockDuration);
      this.logger.warn(
        `Rate limit exceeded for user ${userId} (${role}) on ${endpointType}`,
      );
      return true;
    }

    return false;
  }

  async getRemainingPoints(
    userId: string,
    role: Role,
    endpointType: string,
  ): Promise<number> {
    const config = this.limits.get(role)?.[endpointType];
    if (!config) {
      return -1;
    }

    const key = this.getKey(userId, endpointType);
    const current = await this.redisService.get(key);
    return config.points - (current ? parseInt(current, 10) : 0);
  }

  async resetLimits(userId: string, endpointType: string): Promise<void> {
    const key = this.getKey(userId, endpointType);
    const blockKey = this.getBlockKey(userId, endpointType);
    await this.redisService.del(key);
    await this.redisService.del(blockKey);
    this.logger.log(`Rate limits reset for user ${userId} on ${endpointType}`);
  }
}
