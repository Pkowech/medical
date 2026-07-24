import { Injectable, BadRequestException, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { getErrorMessage } from '#common/utils/error.utils';
import { SearchQueryDto, SearchResponseDto, SearchResult } from '#common/dto/search.dto';
import { MedicalSynonymService } from './medical-synonym.service';
import { AiAnalyticsService } from '#modules/ai-analytics/services/ai-analytics.service';

interface SearchMetrics {
  totalTime: number;
  queryTime: number;
  databaseTime: number;
  resultCount: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly MIN_QUERY_LENGTH = 2;
  private readonly MAX_QUERY_LENGTH = 200;
  private readonly MAX_PAGE_SIZE = 100;
  private readonly DEFAULT_PAGE_SIZE = 10;
  private readonly SEARCH_TIMEOUT_MS = 5000;
  private readonly METRICS_ENABLE = true;

  constructor(
    private readonly prisma: PrismaService,
    private readonly synonymService: MedicalSynonymService,
    private readonly aiAnalytics: AiAnalyticsService,
  ) {}

  async search(searchQuery: SearchQueryDto): Promise<SearchResponseDto & { metrics?: SearchMetrics }> {
    const startTime = performance.now();
    const { query, page = 1, limit = this.DEFAULT_PAGE_SIZE, type, courseContextId } = searchQuery;

    this.validateSearchInput(query, page, limit);
    const sanitizedQuery = this.sanitizeQuery(query);

    const metrics: SearchMetrics = {
      totalTime: 0,
      queryTime: 0,
      databaseTime: 0,
      resultCount: 0,
    };

    try {
      // 1. Expand query with medical synonyms
      const { expandedQuery, matches: synonymsMatched } = await this.synonymService.expandQuery(sanitizedQuery);

      const dbStartTime = performance.now();

      // 2. Execute search against GlobalSearchIndex using FTS and Fuzzy matching
      const { results, total, facets } = await this.executeWithFts(
        expandedQuery,
        query,
        type,
        page || 1,
        limit || 10,
        courseContextId,
      );

      metrics.databaseTime = performance.now() - dbStartTime;
      metrics.queryTime = metrics.databaseTime;
      metrics.resultCount = results.length;
      metrics.totalTime = performance.now() - startTime;

      this.validateSearchResponse(results, total);

      // 3. Track search analytics
      this.trackSearchAnalytics(searchQuery, results, total, metrics).catch(err => 
        this.logger.warn('Failed to track search analytics', err)
      );

      this.logger.debug(
        `Search completed: query="${sanitizedQuery}", expanded="${expandedQuery}", results=${results.length}/${total}, time=${metrics.totalTime.toFixed(2)}ms`,
      );

      return {
        results,
        total,
        page: page || 1,
        limit: limit || 10,
        expandedQuery,
        synonymsMatched,
        facets,
        metrics: this.METRICS_ENABLE ? metrics : undefined,
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      metrics.totalTime = performance.now() - startTime;

      this.logger.error(`Search failed for query: "${sanitizedQuery}"`, {
        error: msg,
        type,
        page,
        limit,
        metrics,
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Search operation failed. Please try again or contact support.',
      );
    }
  }

  /**
   * Search against the GlobalSearchIndex table using Full-Text Search and Trigram similarity
   */
  private async executeWithFts(
    expandedQuery: string,
    originalQuery: string,
    type: string | undefined,
    page: number,
    limit: number,
    courseContextId?: string,
  ): Promise<{ results: any[]; total: number; facets: Record<string, number> }> {
    const offset = (page - 1) * limit;
    const typeFilter = type ? `AND entity_type = '${type}'` : '';
    const contextFilter = courseContextId 
      ? `AND (metadata->>'courseId' = '${courseContextId}' OR metadata->>'courseContextId' = '${courseContextId}')` 
      : '';

    const ftsQuery = this.formatFtsQuery(expandedQuery);
    
    // 1. Calculate Total Count (combining FTS and Fuzzy Trigram)
    const countQuery = `
      SELECT COUNT(*)::int as total 
      FROM "global_search_index"
      WHERE (fts @@ to_tsquery('english', $1))
      OR (title % $2)
      ${typeFilter} ${contextFilter}
    `;

    const countResult = await this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
      countQuery,
      ftsQuery,
      originalQuery,
    );
    const total = countResult[0]?.total || 0;

    // 2. Fetch results with ranking and snippets
    // We use ts_rank_cd for better density-based ranking and ts_headline for highlighting
    const resultsQuery = `
      SELECT 
        entity_id as id, 
        entity_type as type, 
        title, 
        description, 
        ts_rank_cd(fts, to_tsquery('english', $1), 32)::float8 as fts_relevance,
        similarity(title, $2)::float8 as trgm_relevance,
        ts_headline('english', coalesce(content, description, ''), to_tsquery('english', $1), 
          'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, ShortWord=3, HighlightAll=FALSE') as snippet
      FROM "global_search_index"
      WHERE (fts @@ to_tsquery('english', $1))
      OR (title % $2)
      ${typeFilter} ${contextFilter}
      ORDER BY (fts_relevance * 0.8 + trgm_relevance * 0.2) DESC, created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const results = await this.prisma.$queryRawUnsafe<any[]>(
      resultsQuery,
      ftsQuery,
      originalQuery,
      limit,
      offset,
    );

    // 3. Calculate Facets (Result counts per type)
    const facetsQuery = `
      SELECT entity_type as type, COUNT(*)::int as count
      FROM "global_search_index"
      WHERE (fts @@ to_tsquery('english', $1))
      OR (title % $2)
      ${contextFilter}
      GROUP BY entity_type
    `;

    const facetsResult = await this.prisma.$queryRawUnsafe<Array<{ type: string; count: number }>>(
      facetsQuery,
      ftsQuery,
      originalQuery,
    );

    const facets = facetsResult.reduce(
      (acc, curr) => ({ ...acc, [curr.type]: curr.count }),
      {},
    );

    return {
      results: results.map((r) => ({
        ...r,
        relevance: Math.min(1, (r.fts_relevance || 0) + (r.trgm_relevance || 0)),
        fileType: this.getFileType(r.type),
      })),
      total,
      facets,
    };
  }

  private formatFtsQuery(query: string): string {
    // If it already has operators (| or &), assume it's expanded
    if (query.includes('|') || query.includes('&')) {
      return query;
    }
    // Otherwise, turn "heart attack" into "heart & attack"
    return query.trim().split(/\s+/).join(' & ');
  }

  private async trackSearchAnalytics(
    query: SearchQueryDto,
    results: SearchResult[],
    total: number,
    metrics: SearchMetrics,
  ): Promise<void> {
    // We'll track this as a custom event for the AI Analytics service
    // This allows us to correlate "Search -> Material View -> Quiz Success" later.
    await this.aiAnalytics.trackEvent(
      'SYSTEM_SEARCH', // Search might be by unauthenticated user, but let's assume we have a context
      'search.performed',
      {
        query: query.query,
        resultCount: results.length,
        totalFound: total,
        metrics,
        topResultId: results[0]?.id,
        topResultType: results[0]?.type,
      },
      new Date().toISOString()
    );
  }

  private validateSearchInput(query: string, page: number, limit: number): void {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query cannot be empty');
    }
    if (query.length < this.MIN_QUERY_LENGTH) {
      throw new BadRequestException(`Search query must be at least ${this.MIN_QUERY_LENGTH} characters`);
    }
    if (query.length > this.MAX_QUERY_LENGTH) {
      throw new BadRequestException(`Search query cannot exceed ${this.MAX_QUERY_LENGTH} characters`);
    }
  }

  private validateSearchResponse(results: any[], total: number): void {
    if (!Array.isArray(results)) {
      throw new InternalServerErrorException('Invalid search response format');
    }
  }

  private sanitizeQuery(query: string): string {
    return query.trim().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private getFileType(entityType: string): string {
    const typeMap: Record<string, string> = {
      course: 'course',
      material: 'document',
      unit: 'module',
      topic: 'topic',
      user: 'profile',
      quiz: 'assessment',
      clinical_case: 'case',
    };
    return typeMap[entityType] || 'unknown';
  }
}
