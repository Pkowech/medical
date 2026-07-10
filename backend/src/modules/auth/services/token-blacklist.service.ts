import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '#infrastructure/redis/redis.service';
import { securityEventTypes } from '#common/dto/security.dto';
import { getErrorMessage } from '#common/utils/error.utils';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
    await this.redisService.set(
      `${this.blacklistPrefix}${token}`,
      '1', // Use '1' instead of 'true' for consistency
      expires,
    );

    this.eventEmitter.emit('security.audit', {
      eventType: securityEventTypes.tokenRevoked,
      userId: 'unknown',
      ipAddress: 'unknown',
      userAgent: 'unknown',
      eventData: { success: true, token, expires },
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

      await this.redisService.set(
        `${this.blacklistPrefix}${token}`,
        '1', // Use '1' instead of 'true'
        ttl,
      );

      this.eventEmitter.emit('security.audit', {
        eventType: securityEventTypes.tokenRevoked,
        userId: decoded.sub || 'unknown',
        ipAddress: 'unknown',
        userAgent: 'unknown',
        eventData: {
          success: true,
          token: `${token.substring(0, 20)}...`,
          expires: ttl,
        },
      });
    } catch (error) {
      await this.redisService.set(
        `${this.blacklistPrefix}${token}`,
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
          token: `${token.substring(0, 20)}...`,
          expires: this.defaultTtl,
          error: getErrorMessage(error),
        },
      });
    }
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const result = await this.redisService.get<string>(
      `${this.blacklistPrefix}${token}`,
    );

    // Check for truthy values: '1', 'true', true, or 1
    const isBlacklisted =
      result === '1' ||
      result === 'true' ||
      String(result) === 'true' ||
      String(result) === '1';

    return isBlacklisted;
  }

  async clearExpiredTokens(): Promise<void> {
    // Handled by Redis TTL
  }
}
