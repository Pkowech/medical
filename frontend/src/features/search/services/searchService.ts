import { apiService } from '@/features/auth/services/apiClient';

export interface SearchResult {
  id: string;
  type: 'course' | 'material' | 'unit' | 'topic' | 'user';
  title: string;
  description?: string;
  relevance: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
}

export interface SearchParams {
  query: string;
  type?: 'course' | 'material' | 'unit' | 'topic' | 'user' | 'all';
  page?: number;
  limit?: number;
}

/**
 * Search for courses, materials, units, topics, and users using PostgreSQL full-text search (FTS)
 * @param params - Search parameters (query, type, page, limit)
 * @returns Search results with relevance ranking
 */
export async function searchEntities(params: SearchParams): Promise<SearchResponse> {
  const { query, type = 'all', page = 1, limit = 10 } = params;

  if (!query || query.trim().length === 0) {
    return { results: [], total: 0, page, limit };
  }

  try {
    const response = await apiService.get<SearchResponse>('/search', {
      params: {
        query,
        type: type !== 'all' ? type : undefined,
        page,
        limit,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Search service error:', error);
    throw error;
  }
}

/**
 * Perform a quick search with default limit for autocomplete/suggestions
 */
export async function quickSearch(query: string, type?: string): Promise<SearchResult[]> {
  try {
    const response = await searchEntities({
      query,
      type: (type || 'all') as SearchParams['type'],
      page: 1,
      limit: 6,
    });
    return response.results;
  } catch (error) {
    console.error('Quick search error:', error);
    return [];
  }
}

/**
 * Get search suggestions based on partial query
 */
export async function getSearchSuggestions(query: string): Promise<string[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    const results = await quickSearch(query);
    // Extract unique titles as suggestions
    const suggestions = Array.from(new Set(results.map(r => r.title))).slice(0, 5);
    return suggestions;
  } catch (error) {
    console.error('Get suggestions error:', error);
    return [];
  }
}
