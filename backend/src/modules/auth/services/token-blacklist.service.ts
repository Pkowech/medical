import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '#infrastructure/redis/redis.service';
import { securityEventTypes } from '#common/dto/security.dto';
import { getErrorMessage } from '#common/utils/error.utils';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'crypto';

@Injectable()
export class TokenBlacklistService {
  private readonly blacklistPrefix = 'token:blacklist:';
  private readonly defaultTtl = 24 * 60 * 60; // 24 hours

  constructor(
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async addToBlacklist(token: string, expires: number): Promise<void> {
    await this.redisService.set(this.getBlacklistKey(token), '1', expires);

    this.eventEmitter.emit('security.audit', {
      eventType: securityEventTypes.tokenRevoked,
      userId: 'unknown',
      ipAddress: 'unknown',
      userAgent: 'unknown',
      eventData: { success: true, expires },
    });
  }

  async blacklistToken(token: string): Promise<void> {
    try {
      const decoded = this.jwtService.decode(token);
      if (!decoded || typeof decoded === 'string') {
        throw new Error('Invalid token format');
      }

      const exp = decoded.exp;
      const now = Math.floor(Date.now() / 1000);
      const ttl = exp ? Math.max(exp - now, 60) : this.defaultTtl; // Ensure at least 60s TTL

      await this.redisService.set(this.getBlacklistKey(token), '1', ttl);

      this.eventEmitter.emit('security.audit', {
        eventType: securityEventTypes.tokenRevoked,
        userId: decoded.sub || 'unknown',
        ipAddress: 'unknown',
        userAgent: 'unknown',
        eventData: {
          success: true,
          expires: ttl,
        },
      });
    } catch (error) {
      await this.redisService.set(
        this.getBlacklistKey(token),
        '1',
        this.defaultTtl,
      );

      this.eventEmitter.emit('security.audit', {
        eventType: securityEventTypes.tokenRevoked,
        userId: 'unknown',
        ipAddress: 'unknown',
        userAgent: 'unknown',
        eventData: {
          success: true,
          expires: this.defaultTtl,
          error: getErrorMessage(error),
        },
      });
    }
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const hashedKey = this.getBlacklistKey(token);
    if (this.isBlacklistedValue(await this.redisService.get(hashedKey))) {
      return true;
    }

    // Read and migrate entries created before blacklist keys were hashed.
    const legacyKey = `${this.blacklistPrefix}${token}`;
    if (!this.isBlacklistedValue(await this.redisService.get(legacyKey))) {
      return false;
    }
    const legacyTtl = await this.redisService.ttl(legacyKey);
    await this.redisService.set(
      hashedKey,
      '1',
      legacyTtl > 0
        ? legacyTtl
        : legacyTtl === -1
          ? undefined
          : this.defaultTtl,
    );
    await this.redisService.del(legacyKey);
    return true;
  }

  private getBlacklistKey(token: string): string {
    const digest = createHash('sha256').update(token, 'utf8').digest('hex');
    return `${this.blacklistPrefix}${digest}`;
  }

  private isBlacklistedValue(value: unknown): boolean {
    return value === '1' || value === 'true' || value === true || value === 1;
  }

  async clearExpiredTokens(): Promise<void> {
    // Handled by Redis TTL
  }
}
