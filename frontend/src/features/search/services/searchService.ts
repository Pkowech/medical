import { apiService } from '@/features/auth/services/apiClient';
import { SEARCH_CONFIG, SEARCH_ERROR_MESSAGES } from '../config/searchConfig';

/**
 * Enhanced search error class
 */
export class SearchError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'SearchError';
  }
}

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  description?: string;
  relevance: number;
  fileType?: string;
  instructor?: { name: string };
  snippet?: string; // Highlighted snippet from backend
  metadata?: Record<string, string | number | boolean>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  expandedQuery?: string;
  synonymsMatched?: string[];
  facets?: Record<string, number>;
  metrics?: {
    queryTime: number;
    totalTime: number;
    resultCount: number;
  };
}

export interface SearchParams {
  query: string;
  type?: string;
  page?: number;
  limit?: number;
  courseContextId?: string;
  contextType?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Simple LRU cache for search results
 */
class SearchCache {
  private cache: Map<string, { data: SearchResponse; timestamp: number }> = new Map();
  private readonly maxSize = SEARCH_CONFIG.CACHE_MAX_SIZE;
  private readonly ttl = SEARCH_CONFIG.CACHE_TTL_MS;

  set(key: string, data: SearchResponse): void {
    // Remove oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string): SearchResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

const searchCache = new SearchCache();

/**
 * Generate cache key from search parameters
 */
function getCacheKey(params: SearchParams): string {
  return JSON.stringify({
    q: params.query,
    t: params.type,
    p: params.page,
    l: params.limit,
    c: params.courseContextId,
  });
}

/**
 * Validate search query
 */
function validateQuery(query: string): void {
  if (!query || query.trim().length === 0) {
    throw new SearchError(
      SEARCH_ERROR_MESSAGES.EMPTY_QUERY,
      'EMPTY_QUERY',
      400,
      false
    );
  }

  if (query.trim().length < SEARCH_CONFIG.MIN_QUERY_LENGTH) {
    throw new SearchError(
      SEARCH_ERROR_MESSAGES.MIN_LENGTH,
      'MIN_LENGTH',
      400,
      false
    );
  }

  if (query.length > SEARCH_CONFIG.MAX_QUERY_LENGTH) {
    throw new SearchError(
      SEARCH_ERROR_MESSAGES.MAX_LENGTH,
      'MAX_LENGTH',
      400,
      false
    );
  }
}

/**
 * Retry logic with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = SEARCH_CONFIG.MAX_RETRIES
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // Don't retry non-retryable errors
      if (error instanceof SearchError && !error.retryable) {
        throw error;
      }

      // Check for rate limiting (429)
      if ((error as any)?.status === 429) {
        throw new SearchError(
          SEARCH_ERROR_MESSAGES.RATE_LIMITED,
          'RATE_LIMITED',
          429,
          false
        );
      }

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries - 1) {
        const delayMs = SEARCH_CONFIG.RETRY_DELAY_MS * 
          Math.pow(SEARCH_CONFIG.RETRY_BACKOFF_MULTIPLIER, attempt);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Search for entities (courses, materials, units, topics, users, etc.)
 * Uses caching and retry logic for production-grade reliability
 */
export async function searchEntities(
  params: SearchParams,
  options: { useCache: boolean; skipValidation: boolean } = { useCache: true, skipValidation: false }
): Promise<SearchResponse> {
  const {
    query,
    type = 'all',
    page = 1,
    limit = SEARCH_CONFIG.DEFAULT_PAGE_SIZE,
    courseContextId,
    contextType,
    sortBy,
    sortOrder,
  } = params;

  // Validate query
  if (!options.skipValidation) {
    validateQuery(query);
  }

  // Check cache first
  const cacheKey = getCacheKey({ query, type, page, limit, courseContextId });
  if (options.useCache && searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Execute search with retry logic
  const searchFn = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SEARCH_CONFIG.REQUEST_TIMEOUT_MS);

      const requestParams: Record<string, string | number> = {
        query,
        page: String(page),
        limit: String(limit),
      };

      if (type && type !== 'all') requestParams.type = type;
      if (courseContextId) requestParams.courseContextId = courseContextId;
      if (contextType) requestParams.contextType = contextType;
      if (sortBy) requestParams.sortBy = sortBy;
      if (sortOrder) requestParams.sortOrder = sortOrder;

      const response = await apiService.get<SearchResponse>('/search', {
        params: requestParams,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = response.data;

      // Cache successful results
      if (options.useCache) {
        searchCache.set(cacheKey, data);
      }

      return data;
    } catch (error: unknown) {
      if ((error as Record<string, unknown>)?.name === 'AbortError') {
        throw new SearchError(
          SEARCH_ERROR_MESSAGES.TIMEOUT,
          'TIMEOUT',
          408,
          true
        );
      }

      if ((error as any)?.code === 'ERR_NETWORK') {
        throw new SearchError(
          SEARCH_ERROR_MESSAGES.NETWORK_ERROR,
          'NETWORK_ERROR',
          0,
          true
        );
      }

      if ((error as any)?.response?.status === 500) {
        throw new SearchError(
          SEARCH_ERROR_MESSAGES.SERVER_ERROR,
          'SERVER_ERROR',
          500,
          true
        );
      }

      throw error;
    }
  };

  return retryWithBackoff(searchFn);
}

/**
 * Quick search with reduced limit for autocomplete
 */
export async function quickSearch(
  query: string,
  type?: string,
  contextId?: string
): Promise<SearchResult[]> {
  try {
    const response = await searchEntities(
      {
        query,
        type: type || 'all',
        page: 1,
        limit: SEARCH_CONFIG.HEADER_RESULTS_LIMIT,
        courseContextId: contextId,
      },
      { useCache: true, skipValidation: false }
    );
    return response.results;
  } catch (error) {
    console.error('Quick search error:', error);
    return [];
  }
}

/**
 * Get search suggestions based on partial query
 * Returns unique titles from quick search results
 */
export async function getSearchSuggestions(query: string): Promise<string[]> {
  if (!query || query.trim().length < SEARCH_CONFIG.MIN_QUERY_LENGTH) {
    return [];
  }

  try {
    const results = await quickSearch(query);
    // Extract unique titles as suggestions, limit to 5
    const suggestions = Array.from(new Set(results.map(r => r.title)))
      .slice(0, 5);
    return suggestions;
  } catch (error) {
    console.error('Get suggestions error:', error);
    return [];
  }
}

/**
 * Clear search cache (useful on logout or permission changes)
 */
export function clearSearchCache(): void {
  searchCache.clear();
}

/**
 * Prefetch search results (for optimization)
 */
export async function prefetchSearch(
  query: string,
  type?: string
): Promise<void> {
  try {
    await searchEntities(
      {
        query,
        type: type || 'all',
        page: 1,
        limit: SEARCH_CONFIG.DEFAULT_PAGE_SIZE,
      },
      { useCache: true, skipValidation: true }
    );
  } catch (error) {
    // Silent prefetch failure
    if (process.env.NODE_ENV === 'development') {
      console.warn('Prefetch failed:', error);
    }
  }
}
