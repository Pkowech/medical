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

  async createRefreshToken(
    userId: string,
    expiresInSeconds?: number,
    deferAudit = false,
    sessionId?: string,
  ): Promise<string> {
    const refreshToken = uuidv4();
    const configuredExpiry = Number.parseInt(
      this.configService.get('JWT_REFRESH_EXPIRATION', '604800'),
      10,
    );
    const refreshTokenExpiry = expiresInSeconds ?? configuredExpiry;

    const tokenData: TokenData = {
      token: refreshToken,
      userId,
      sessionId,
      expiresAt: new Date(Date.now() + refreshTokenExpiry * 1000),
    };

    const tokenKey = `${this.tokenPrefix}${refreshToken}`;
    const userTokensKey = `${this.userTokensPrefix}${userId}`;

    const startTime = Date.now();

    await this.redisService.setAndAddToSet(
      tokenKey,
      tokenData,
      refreshTokenExpiry,
      userTokensKey,
      tokenKey,
    );

    const duration = Date.now() - startTime;
    this.logger.debug(
      `[perf] redis set and sadd for refresh token took ${duration}ms`,
    );

    this.logger.debug(`Created refresh token for user ${userId}`);
    if (!deferAudit) {
      await this.auditLogService.log(
        securityEventTypes.tokenRefresh,
        userId,
        'unknown',
        'unknown',
        { success: true, action: 'create' },
      );
    }

    return refreshToken;
  }

  async validateAndGetUserId(refreshToken: string): Promise<string | null> {
    this.logger.debug('Validating refresh token');
    try {
      const tokenKey = `${this.tokenPrefix}${refreshToken}`;
      this.logger.debug('[perf] validating refresh token');
      const startTime = Date.now();
      const data = await this.redisService.get(tokenKey);
      const duration = Date.now() - startTime;
      this.logger.debug(
        `[perf] redis get for refresh token took ${duration}ms`,
      );

      if (!data) {
        this.logger.warn('Refresh token not found in Redis');
        return null;
      }

      const tokenData: TokenData = data;
      if (new Date(tokenData.expiresAt) < new Date()) {
        this.logger.warn(
          `Expired refresh token found. Expires at: ${String(tokenData.expiresAt)}`,
        );
        await this.redisService.del(tokenKey);
        return null;
      }

      this.logger.debug(
        `Refresh token is valid for user ${tokenData.userId}`,
      );
      return tokenData.userId;
    } catch (error: unknown) {
      this.logger.error(
        `Error validating refresh token: ${String(error)}`,
      );
      return null;
    }
  }

  async getSessionId(refreshToken: string): Promise<string | null> {
    const tokenData = await this.redisService.get<TokenData>(
      `${this.tokenPrefix}${refreshToken}`,
    );
    if (!tokenData || new Date(tokenData.expiresAt) < new Date()) {
      return null;
    }
    return tokenData.sessionId ?? null;
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
      await this.redisService.removeFromSet(userTokensKey, tokenKey);

      await this.auditLogService.log(
        securityEventTypes.tokenRevoked,
        tokenData.userId,
        'unknown',
        'unknown',
        { success: true, action: 'revoke' },
      );
    } catch (error: unknown) {
      this.logger.error(`Error revoking refresh token: ${String(error)}`);
      throw error;
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    const userTokensKey = `${this.userTokensPrefix}${userId}`;
    const tokenKeys = await this.redisService.getSetMembers(userTokensKey);
    await Promise.all(tokenKeys.map((tokenKey) => this.redisService.del(tokenKey)));
    await this.redisService.del(userTokensKey);
  }

  async revokeSessionTokens(userId: string, sessionId: string): Promise<void> {
    const userTokensKey = `${this.userTokensPrefix}${userId}`;
    const tokenKeys = await this.redisService.getSetMembers(userTokensKey);
    for (const tokenKey of tokenKeys) {
      if (!tokenKey.startsWith(this.tokenPrefix)) continue;
      const tokenData = await this.redisService.get<TokenData>(tokenKey);
      if (tokenData?.sessionId !== sessionId) continue;
      await this.redisService.del(tokenKey);
      await this.redisService.removeFromSet(userTokensKey, tokenKey);
    }
  }
}
