import { useCallback, useState, useRef, useEffect } from 'react';
import { SearchError, searchEntities } from '../services/searchService';
import { SEARCH_CONFIG } from '../config/searchConfig';

export interface SearchMetrics {
  queryTime: number;
  totalTime: number;
  resultCount: number;
  cacheHit?: boolean;
  retryAttempts?: number;
}

export interface SearchErrorInfo {
  message: string;
  code: string;
  statusCode?: number;
  retryable: boolean;
  timestamp: number;
}

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  description?: string;
  relevance: number;
  fileType: string;
  instructor?: { name: string };
  snippet?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface UseSearchReturn {
  results: SearchResult[];
  total: number;
  facets: Record<string, number>;
  expandedQuery?: string;
  synonymsMatched: string[];
  loading: boolean;
  error: SearchErrorInfo | null;
  search: (query: string, type?: string, page?: number, limit?: number, contextType?: string, contextId?: string) => Promise<void>;
  clearSearch: () => void;
  retry: () => Promise<void>;
  metrics: SearchMetrics | null;
}

export interface SearchParams {
  query: string;
  type?: string;
  page: number;
  limit: number;
  contextType?: string;
  contextId?: string;
}

/**
 * Industrial-grade search hook with metrics, error handling, and retry logic
 */
export function useSearch(): UseSearchReturn {
  // Results state
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Record<string, number>>({});
  const [expandedQuery, setExpandedQuery] = useState<string | undefined>();
  const [synonymsMatched, setSynonymsMatched] = useState<string[]>([]);

  // Loading and error state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SearchErrorInfo | null>(null);

  // Metrics state
  const [metrics, setMetrics] = useState<SearchMetrics | null>(null);

  // Refs for cleanup and retry logic
  const abortRef = useRef<AbortController | null>(null);
  const lastSearchParamsRef = useRef<SearchParams | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Perform search with full error handling and analytics
   */
  const search = useCallback(
    async (
      query: string,
      type: string = 'all',
      page = 1,
      limit: number = SEARCH_CONFIG.DEFAULT_PAGE_SIZE,
      contextType?: string,
      contextId?: string
    ) => {
      // Abort previous request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      // Clear empty or too-short queries
      if (!query || query.trim().length < SEARCH_CONFIG.MIN_QUERY_LENGTH) {
        setResults([]);
        setTotal(0);
        setFacets({});
        setExpandedQuery(undefined);
        setSynonymsMatched([]);
        setError(null);
        setMetrics(null);
        return;
      }

      setLoading(true);
      setError(null);
      const startTime = performance.now();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      // Save search params for retry
      lastSearchParamsRef.current = { query, type, page, limit, contextType, contextId };

      try {
        const response = await searchEntities({
          query,
          type: type !== 'all' ? type : undefined,
          page,
          limit,
          courseContextId: contextId,
          contextType,
        });

        // Process response
        setResults((response.results || []) as SearchResult[]);
        setTotal(response.total || 0);
        setFacets(response.facets || {});
        setExpandedQuery(response.expandedQuery);
        setSynonymsMatched(response.synonymsMatched || []);

        // Record metrics
        const totalTime = performance.now() - startTime;
        setMetrics({
          queryTime: response.metrics?.queryTime || totalTime,
          totalTime,
          resultCount: response.results?.length || 0,
        });

        // Track search analytics (non-blocking)
        trackSearchAnalytics({
          query,
          type,
          resultCount: response.results?.length || 0,
          totalFound: response.total || 0,
          responseTime: totalTime,
        }).catch(err => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Analytics error:', err);
          }
        });
      } catch (err: unknown) {
        // Handle abort signal
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        // Process error
        let errorInfo: SearchErrorInfo;
        if (err instanceof SearchError) {
          errorInfo = {
            message: err.message,
            code: err.code,
            statusCode: err.statusCode,
            retryable: err.retryable,
            timestamp: Date.now(),
          };
        } else {
          errorInfo = {
            message: 'An unexpected error occurred during search',
            code: 'UNKNOWN',
            retryable: true,
            timestamp: Date.now(),
          };
        }

        setError(errorInfo);
        setResults([]);
        setTotal(0);
        setFacets({});
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Retry last search
   */
  const retry = useCallback(async () => {
    if (!lastSearchParamsRef.current) {
      return;
    }
    const { query, type, page, limit, contextType, contextId } = lastSearchParamsRef.current;
    await search(query, type, page, limit, contextType, contextId);
  }, [search]);

  /**
   * Clear current search and errors
   */
  const clearSearch = useCallback(() => {
    setResults([]);
    setTotal(0);
    setFacets({});
    setExpandedQuery(undefined);
    setSynonymsMatched([]);
    setError(null);
    setMetrics(null);
    if (abortRef.current) {
      abortRef.current.abort();
    }
    lastSearchParamsRef.current = null;
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    results,
    total,
    facets,
    expandedQuery,
    synonymsMatched,
    loading,
    error,
    search,
    clearSearch,
    retry,
    metrics,
  };
}

/**
 * Track search analytics (non-blocking)
 */
async function trackSearchAnalytics(data: {
  query: string;
  type: string;
  resultCount: number;
  totalFound: number;
  responseTime: number;
}): Promise<void> {
  if (!SEARCH_CONFIG.FEATURES.ENABLE_SEARCH_ANALYTICS) {
    return;
  }

  try {
    // This would integrate with your analytics service
    // For now, just log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Search analytics:', data);
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to track search analytics:', error);
    }
  }
}
