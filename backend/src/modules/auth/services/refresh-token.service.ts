import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenBlacklistService } from './token-blacklist.service';
import { AuditLogService } from './audit-log.service';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '#infrastructure/redis/redis.service';
import type { TokenData } from '#common/dto/security.dto';
import { securityEventTypes } from '#common/dto/security.dto';

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);
  private readonly tokenPrefix = 'refresh_token:';
  private readonly userTokensPrefix = 'user_tokens:';

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private tokenBlacklistService: TokenBlacklistService,
    private auditLogService: AuditLogService,
    private redisService: RedisService,
  ) {}

  async createRefreshToken(userId: string): Promise<string> {
    const refreshToken = uuidv4();
    const refreshTokenExpiry = parseInt(
      this.configService.get('JWT_REFRESH_EXPIRATION', '604800'),
      10,
    );

    const tokenData: TokenData = {
      token: refreshToken,
      userId,
      expiresAt: new Date(Date.now() + refreshTokenExpiry * 1000),
    };

    const tokenKey = `${this.tokenPrefix}${refreshToken}`;
    const userTokensKey = `${this.userTokensPrefix}${userId}`;

    this.logger.debug(`[perf] creating refresh token: ${tokenKey}`);
    const startTime = Date.now();

    await this.redisService.set(tokenKey, tokenData, refreshTokenExpiry);

    if (this.redisService.client) {
      await this.redisService.client.sadd(userTokensKey, tokenKey);
    } else {
      this.logger.warn(
        'Redis client not available; skipping sadd for user tokens',
      );
    }

    const duration = Date.now() - startTime;
    this.logger.debug(
      `[perf] redis set and sadd for refresh token took ${duration}ms`,
    );

    this.logger.debug(
      `Created refresh token for user ${userId}: ${refreshToken}`,
    );
    await this.auditLogService.log(
      securityEventTypes.tokenRefresh,
      userId,
      'unknown',
      'unknown',
      { success: true, action: 'create' },
    );

    return refreshToken;
  }

  async validateAndGetUserId(refreshToken: string): Promise<string | null> {
    this.logger.debug(`Validating refresh token: ${refreshToken}`);
    try {
      const tokenKey = `${this.tokenPrefix}${refreshToken}`;
      this.logger.debug(`[perf] validating refresh token: ${tokenKey}`);
      const startTime = Date.now();
      const data = await this.redisService.get(tokenKey);
      const duration = Date.now() - startTime;
      this.logger.debug(
        `[perf] redis get for refresh token took ${duration}ms`,
      );

      if (!data) {
        this.logger.warn(`Refresh token not found in Redis: ${refreshToken}`);
        return null;
      }

      const tokenData: TokenData = data;
      if (new Date(tokenData.expiresAt) < new Date()) {
        this.logger.warn(
          `Expired refresh token found: ${refreshToken}. Expires at: ${String(tokenData.expiresAt)}`,
        );
        await this.redisService.del(tokenKey);
        return null;
      }

      this.logger.debug(
        `Refresh token ${refreshToken} is valid for user ${tokenData.userId}`,
      );
      return tokenData.userId;
    } catch (error: unknown) {
      this.logger.error(
        `Error validating refresh token ${refreshToken}: ${String(error)}`,
      );
      return null;
    }
  }

  async validateRefreshToken(
    refreshToken: string,
    userId: string,
  ): Promise<boolean> {
    const tokenDataUserId = await this.validateAndGetUserId(refreshToken);
    if (!tokenDataUserId) {
      await this.auditLogService.log(
        securityEventTypes.tokenRefresh,
        userId,
        'unknown',
        'unknown',
        { success: false, reason: 'INVALID_TOKEN' },
      );
      return false;
    }

    return tokenDataUserId === userId;
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const tokenKey = `${this.tokenPrefix}${refreshToken}`;
      const data = await this.redisService.get(tokenKey);
      if (!data) {
        return; // Token doesn't exist
      }

      const tokenData: TokenData = data;
      const userTokensKey = `${this.userTokensPrefix}${tokenData.userId}`;

      await this.redisService.del(tokenKey);
      if (this.redisService.client) {
        await this.redisService.client.srem(userTokensKey, tokenKey);
      } else {
        this.logger.warn(
          'Redis client not available; skipping srem for user tokens',
        );
      }

      await this.auditLogService.log(
        securityEventTypes.tokenRevoked,
        tokenData.userId,
        'unknown',
        'unknown',
        { success: true, token: `${refreshToken.substring(0, 8)}...` },
      );
    } catch (error: unknown) {
      this.logger.error(`Error revoking refresh token: ${String(error)}`);
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    const userTokensKey = `${this.userTokensPrefix}${userId}`;
    if (this.redisService.client) {
      const tokenKeys = await this.redisService.client.smembers(userTokensKey);
      if (tokenKeys && tokenKeys.length > 0) {
        await this.redisService.client.del(...tokenKeys);
      }
    } else {
      this.logger.warn(
        'Redis client not available; skipping revokeAllUserTokens client ops',
      );
    }
    await this.redisService.del(userTokensKey);
  }
}
