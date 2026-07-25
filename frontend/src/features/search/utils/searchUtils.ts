/**
 * Search UI Utilities & Helpers
 * Provides common utilities for search-related UI operations
 */

import { SEARCH_RESULT_ROUTES, SEARCH_RESULT_COLORS, SearchResultType } from '../config/searchConfig';

/**
 * Get navigation URL for a search result
 */
export function getSearchResultRoute(type: string, id: string): string {
  const baseRoute = SEARCH_RESULT_ROUTES[type as SearchResultType] || '/';
  return `${baseRoute}/${id}`;
}

/**
 * Get badge colors for a search result type
 */
export function getSearchResultColors(type: string): { bg: string; text: string } {
  return SEARCH_RESULT_COLORS[type as SearchResultType] || { bg: 'bg-gray-100', text: 'text-gray-700' };
}

/**
 * Format relevance score for display (0-100 scale)
 */
export function formatRelevanceScore(relevance: number): number {
  return Math.min(100, Math.max(0, Math.round(relevance * 100)));
}

/**
 * Determine if a relevance score is high/medium/low
 */
export function getRelevanceLevel(relevance: number): 'high' | 'medium' | 'low' {
  const score = formatRelevanceScore(relevance);
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Get badge text for relevance level
 */
export function getRelevanceBadgeText(relevance: number): string {
  const level = getRelevanceLevel(relevance);
  switch (level) {
    case 'high':
      return 'High Match';
    case 'medium':
      return 'Fair Match';
    case 'low':
      return 'Low Match';
  }
}

/**
 * Get Tailwind color classes for relevance level
 */
export function getRelevanceColorClasses(relevance: number): { bg: string; text: string; border?: string } {
  const level = getRelevanceLevel(relevance);
  switch (level) {
    case 'high':
      return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' };
    case 'medium':
      return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-100' };
    case 'low':
      return { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-100' };
  }
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Highlight search terms in text (simple implementation)
 * For more robust highlighting, use the snippet from backend
 */
export function highlightSearchTerm(text: string, term: string): string {
  if (!term || !text) return text;
  const regex = new RegExp(`(${term})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Format error message for display
 */
export function formatSearchErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    EMPTY_QUERY: 'Please enter a search query',
    MIN_LENGTH: 'Query must be at least 2 characters',
    MAX_LENGTH: 'Query is too long',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    TIMEOUT: 'Search timed out. Please try again.',
    SERVER_ERROR: 'Server error. Please try again later.',
    RATE_LIMITED: 'Too many requests. Please wait before searching again.',
    UNKNOWN: 'An error occurred. Please try again.',
  };
  return messages[code] || messages.UNKNOWN;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(code: string): boolean {
  const retryableCodes = ['TIMEOUT', 'NETWORK_ERROR', 'SERVER_ERROR'];
  return retryableCodes.includes(code);
}

/**
 * Format search metrics for display
 */
export function formatSearchMetrics(
  queryTime?: number,
  totalTime?: number
): { display: string; detailed: string } {
  const total = totalTime || queryTime || 0;
  
  if (total < 1000) {
    return {
      display: `${Math.round(total)}ms`,
      detailed: `${Math.round(total)}ms`,
    };
  }
  
  const seconds = (total / 1000).toFixed(2);
  return {
    display: `${seconds}s`,
    detailed: `${Math.round(total)}ms (${seconds}s)`,
  };
}

/**
 * Parse keyboard shortcut from event
 */
export function getKeyboardShortcut(event: KeyboardEvent): string | null {
  const keys: string[] = [];

  if (event.metaKey) keys.push('Meta');
  if (event.ctrlKey && !event.metaKey) keys.push('Control');
  if (event.altKey) keys.push('Alt');
  if (event.shiftKey) keys.push('Shift');

  // Add the actual key
  if (event.key && event.key !== 'Meta' && event.key !== 'Control' && event.key !== 'Alt' && event.key !== 'Shift') {
    keys.push(event.key);
  }

  return keys.length > 0 ? keys.join('+') : null;
}

/**
 * Check if keyboard shortcut matches a target
 */
export function matchesKeyboardShortcut(event: KeyboardEvent, targets: readonly string[]): boolean {
  const shortcut = getKeyboardShortcut(event);
  return shortcut ? targets.includes(shortcut) : false;
}

/**
 * Generate search history key for localStorage
 */
export function getSearchHistoryKey(userId?: string): string {
  if (userId) {
    return `search_history_${userId}`;
  }
  return 'search_history';
}

/**
 * Format number for display (e.g., 1000 -> "1K")
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Create accessible ARIA label for search result
 */
export function createSearchResultAriaLabel(
  title: string,
  type: string,
  description?: string
): string {
  const parts = [
    title,
    `Type: ${type}`,
  ];
  if (description) {
    parts.push(description);
  }
  return parts.join(', ');
}
