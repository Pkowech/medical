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
   * Properly parameterizes all user inputs to prevent SQL injection.
   */
  private async executeWithFts(
    expandedQuery: string,
    originalQuery: string,
    type: string | undefined,
    page: number,
    limit: number,
    courseContextId?: string,
  ): Promise<{ results: any[]; total: number; facets: Record<string, number> }> {
    // Enforce search timeout using a race condition
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new InternalServerErrorException('Search operation exceeded timeout')), this.SEARCH_TIMEOUT_MS)
    );

    const searchPromise = this.performSearch(expandedQuery, originalQuery, type, page, limit, courseContextId);
    return Promise.race([searchPromise, timeoutPromise]);
  }

  /**
   * Internal search implementation with proper parameter binding
   */
  private async performSearch(
    expandedQuery: string,
    originalQuery: string,
    type: string | undefined,
    page: number,
    limit: number,
    courseContextId?: string,
  ): Promise<{ results: any[]; total: number; facets: Record<string, number> }> {
    const offset = (page - 1) * limit;

    // Build parameter array and filter clauses with proper placeholders
    const params: unknown[] = [expandedQuery, originalQuery];
    let typeFilterForResults = '';
    let contextFilterForResults = '';
    let contextFilterForFacets = '';

    // Parameterize type filter
    if (type) {
      params.push(type);
      const typeParamIdx = params.length;
      typeFilterForResults = `AND entity_type = $${typeParamIdx}`;
    }

    // Parameterize context filter (uses same parameter for both OR conditions)
    if (courseContextId) {
      params.push(courseContextId);
      const contextParamIdx = params.length;
      contextFilterForResults = `AND (metadata->>'courseId' = $${contextParamIdx} OR metadata->>'courseContextId' = $${contextParamIdx})`;
      contextFilterForFacets = `AND (metadata->>'courseId' = $${contextParamIdx} OR metadata->>'courseContextId' = $${contextParamIdx})`;
    }

    // Use websearch_to_tsquery for robust handling of arbitrary user text (handles quotes, hyphens, etc.)
    // Fallback to to_tsquery if websearch_to_tsquery unavailable in this PostgreSQL version
    const usesWebsearch = true; // Set to false if your PG version doesn't support websearch_to_tsquery
    const tsqueryFunc = usesWebsearch ? 'websearch_to_tsquery' : 'to_tsquery';
    const tsqueryCall = usesWebsearch ? `${tsqueryFunc}('english', $1)` : `${tsqueryFunc}('english', $1)`;

    // 1. Fetch results with ranking, snippets, and total count in one query (using window function)
    const resultsQuery = `
      SELECT 
        entity_id as id, 
        entity_type as type, 
        title, 
        description, 
        ts_rank_cd(fts, ${tsqueryCall}, 32)::float8 as fts_relevance,
        similarity(title, $2)::float8 as trgm_relevance,
        ts_headline('english', coalesce(content, description, ''), ${tsqueryCall}, 
          'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, ShortWord=3, HighlightAll=FALSE') as snippet,
        COUNT(*)::int OVER() as total_count
      FROM "global_search_index"
      WHERE (fts @@ ${tsqueryCall})
      OR (title % $2)
      ${typeFilterForResults} ${contextFilterForResults}
      ORDER BY (fts_relevance * 0.8 + trgm_relevance * 0.2) DESC, created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const results = await this.prisma.$queryRawUnsafe<any[]>(
      resultsQuery,
      ...params,
      limit,
      offset,
    );

    const total = results.length > 0 ? results[0].total_count : 0;

    // 2. Calculate Facets (Result counts per type)
    // Reuse base parameters but rebuild facets filter without typeFilter
    const facetsParams = [expandedQuery, originalQuery];
    if (courseContextId) {
      facetsParams.push(courseContextId);
    }

    const facetsQuery = `
      SELECT entity_type as type, COUNT(*)::int as count
      FROM "global_search_index"
      WHERE (fts @@ ${tsqueryCall})
      OR (title % $2)
      ${contextFilterForFacets}
      GROUP BY entity_type
    `;

    const facetsResult = await this.prisma.$queryRawUnsafe<Array<{ type: string; count: number }>>(
      facetsQuery,
      ...facetsParams,
    );

    const facets = facetsResult.reduce(
      (acc, curr) => ({ ...acc, [curr.type]: curr.count }),
      {},
    );

    return {
      results: results.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        description: r.description,
        snippet: r.snippet,
        relevance: Math.min(1, (r.fts_relevance || 0) + (r.trgm_relevance || 0)),
        fileType: this.getFileType(r.type),
      })),
      total,
      facets,
    };
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

  private validateSearchInput(query: string, _page?: number, _limit?: number): void {
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

  private validateSearchResponse(results: any[], _total?: number): void {
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
