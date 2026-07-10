import { useCallback, useState, useRef } from 'react';
import { apiService } from '@/features/auth/services/apiClient';

export interface SearchError {
  message: string;
  code?: string;
  statusCode?: number;
}

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  description?: string;
  relevance: number;
  fileType: string;
  instructor?: { name: string };
}

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Record<string, number>>({});
  const [expandedQuery, setExpandedQuery] = useState<string | undefined>();
  const [synonymsMatched, setSynonymsMatched] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SearchError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (
    query: string,
    type: string = 'all',
    page = 1,
    limit = 10,
    contextType?: string,
    contextId?: string
  ) => {
    // Abort previous request
    if (abortRef.current) abortRef.current.abort();

    // Clear empty or too-short queries (backend requires min 2 chars)
    if (!query || query.trim().length < 2) {
      setResults([]);
      setTotal(0);
      setFacets({});
      setExpandedQuery(undefined);
      setSynonymsMatched([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const params: any = {
        query,
        page: String(page),
        limit: String(limit),
      };
      
      if (type && type !== 'all') params.type = type;
      if (contextType) params.contextType = contextType;
      if (contextId) params.contextId = contextId;

      const response = await apiService.get<{ 
        results: SearchResult[]; 
        total: number;
        facets?: Record<string, number>;
        expandedQuery?: string;
        synonymsMatched?: string[];
      }>('/search', {
        params,
        signal: ctrl.signal,
      });

      // response.data contains the { results, total, facets, expandedQuery, synonymsMatched } object
      setResults(response.data.results || []);
      setTotal(response.data.total || 0);
      setFacets(response.data.facets || {});
      setExpandedQuery(response.data.expandedQuery);
      setSynonymsMatched(response.data.synonymsMatched || []);

    } catch (err: any) {
      // Handle abort signal
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return;
      }

      const message = err.message || 'Search failed. Please try again.';
      setError({
        message,
        code: err.code || 'UNKNOWN',
        statusCode: err.status || 500
      });
      setResults([]);
      setTotal(0);
      setFacets({});
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (abortRef.current) {
      abortRef.current.abort();
    }
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
  } as const;
}
