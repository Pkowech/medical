// src/modules/search/services/search-cache.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '#infrastructure/redis/redis.service';
import { getErrorMessage } from '#common/utils/error.utils';
import { SearchQueryDto, SearchResponseDto } from '#common/dto/search.dto';

@Injectable()
export class SearchCacheService {
  private readonly logger = new Logger(SearchCacheService.name);
  private readonly DEFAULT_TTL = 3600; // 1 hour
  private readonly LONG_TAIL_TTL = 7200; // 2 hours for longer queries (more specific results)
  private readonly SHORT_TAIL_TTL = 1800; // 30 minutes for short queries (more dynamic results)

  constructor(private readonly redisService: RedisService) {}

  /**
   * Get cached search results if available.
   * Returns null if cache miss or Redis error.
   */
  async getCachedResults(
    queryDto: SearchQueryDto,
  ): Promise<SearchResponseDto | null> {
    try {
      const cacheKey = this.generateCacheKey(queryDto);
      const cached = await this.redisService.get(cacheKey);

      if (cached) {
        this.logger.debug(`Cache hit for key: ${cacheKey}`);
        // `RedisService.get` already attempts to parse stored JSON and returns
        // a parsed object when available; avoid parsing again here. Return the
        // cached value directly.
        return cached;
      }

      this.logger.debug(`Cache miss for key: ${cacheKey}`);
      return null;
    } catch (error) {
      // Don't throw on cache errors - fall back to database query
      this.logger.warn(`Cache retrieval failed: ${getErrorMessage(error)}`);
      return null;
    }
  }

  /**
   * Cache search results with adaptive TTL based on query characteristics.
   * Longer, more specific queries are cached longer.
   */
  async cacheResults(
    queryDto: SearchQueryDto,
    results: SearchResponseDto,
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(queryDto);
      const ttl = this.calculateTTL(queryDto.query);

      await this.redisService.set(cacheKey, JSON.stringify(results), ttl);

      this.logger.debug(
        `Cached results for key: ${cacheKey} with TTL: ${ttl}s`,
      );
    } catch (error) {
      // Don't throw on cache errors - search result is still valid
      this.logger.warn(`Cache storage failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Invalidate cache for a specific query or pattern.
   * Useful for invalidating cache after data mutations.
   */
  async invalidateCache(queryPattern: string): Promise<void> {
    try {
      this.logger.debug(
        `Cache invalidation requested for pattern: ${queryPattern}`,
      );
      await this.redisService.delPattern(queryPattern);
    } catch (error) {
      this.logger.warn(`Cache invalidation failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Generate a normalized cache key from query parameters.
   * Normalizes whitespace and case to improve cache hit rate.
   */
  private generateCacheKey(queryDto: SearchQueryDto): string {
    const { query, page, limit, type } = queryDto;

    // Normalize query: lowercase, collapse whitespace
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, '_');

    return `search:${normalizedQuery}:p${page}:l${limit}:${type || 'all'}`;
  }

  /**
   * Calculate adaptive TTL based on query characteristics.
   * - Short queries (1-3 words): 30 minutes (more dynamic)
   * - Medium queries (4-5 words): 1 hour (standard)
   * - Long queries (6+ words): 2 hours (more specific, more stable)
   */
  private calculateTTL(query: string): number {
    const wordCount = query.trim().split(/\s+/).length;

    if (wordCount >= 6) {
      return this.LONG_TAIL_TTL;
    } else if (wordCount <= 3) {
      return this.SHORT_TAIL_TTL;
    }

    return this.DEFAULT_TTL;
  }
}
