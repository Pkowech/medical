/**
 * Search History Management Service
 * Manages local search history with localStorage
 */

import { SEARCH_CONFIG } from '../config/searchConfig';

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  type?: string;
  resultCount?: number;
}

class SearchHistoryService {
  private readonly storageKey = 'medical_search_history';
  private readonly maxItems = SEARCH_CONFIG.MAX_SEARCH_HISTORY_ITEMS;

  /**
   * Get search history from localStorage
   */
  getHistory(): SearchHistoryItem[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];
      const history = JSON.parse(stored) as SearchHistoryItem[];
      // Validate and filter expired entries
      return history.filter(item => typeof item.query === 'string' && item.query.length > 0);
    } catch (error) {
      console.error('Failed to get search history:', error);
      return [];
    }
  }

  /**
   * Add item to search history
   */
  addToHistory(query: string, type?: string, resultCount?: number): void {
    if (!query || query.trim().length === 0) return;

    try {
      let history = this.getHistory();

      // Remove duplicate (most recent version should be at top)
      history = history.filter(item => item.query.toLowerCase() !== query.toLowerCase());

      // Add new item at the beginning
      history.unshift({
        query,
        timestamp: Date.now(),
        type,
        resultCount,
      });

      // Limit to max items
      history = history.slice(0, this.maxItems);

      localStorage.setItem(this.storageKey, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to add to search history:', error);
    }
  }

  /**
   * Remove item from history
   */
  removeFromHistory(query: string): void {
    try {
      const history = this.getHistory().filter(
        item => item.query.toLowerCase() !== query.toLowerCase()
      );
      localStorage.setItem(this.storageKey, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to remove from search history:', error);
    }
  }

  /**
   * Clear all search history
   */
  clearHistory(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }

  /**
   * Get recent searches
   */
  getRecentSearches(limit: number = 5): SearchHistoryItem[] {
    return this.getHistory().slice(0, limit);
  }

  /**
   * Search history items by query (case-insensitive)
   */
  searchHistory(query: string): SearchHistoryItem[] {
    const lowerQuery = query.toLowerCase();
    return this.getHistory().filter(item =>
      item.query.toLowerCase().includes(lowerQuery)
    );
  }
}

export const searchHistoryService = new SearchHistoryService();
