/**
 * Search Service Configuration
 * Centralized settings for all search-related operations
 */

export const SEARCH_CONFIG = {
  // Query validation
  MIN_QUERY_LENGTH: 2,
  MAX_QUERY_LENGTH: 200,
  
  // Debouncing
  DEBOUNCE_MS: 300,
  
  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  SEARCH_RESULTS_PAGE_SIZE: 20,
  HEADER_RESULTS_LIMIT: 6,
  
  // Timeouts
  REQUEST_TIMEOUT_MS: 5000,
  KEYBOARD_SHORTCUT_TIMEOUT_MS: 300,
  
  // Retry strategy
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  RETRY_BACKOFF_MULTIPLIER: 2,
  
  // Cache settings
  CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
  CACHE_MAX_SIZE: 50, // Max number of cached searches
  
  // Search history
  MAX_SEARCH_HISTORY_ITEMS: 10,
  SEARCH_HISTORY_STORAGE_KEY: 'medical_search_history',
  
  // Analytics
  TRACK_SEARCH_ANALYTICS: true,
  ANALYTICS_BATCH_SIZE: 10,
  ANALYTICS_FLUSH_INTERVAL_MS: 30000, // 30 seconds
  
  // UI feedback
  LOADING_DELAY_MS: 200, // Show loading after 200ms (avoid flashing)
  
  // Keyboard shortcuts
  KEYBOARD_SHORTCUTS: {
    OPEN_SEARCH: ['Meta+k', 'Control+k', '/'], // Cmd+K, Ctrl+K, or /
    CLOSE_SEARCH: ['Escape'],
    SUBMIT_SEARCH: ['Enter'],
    NAV_DOWN: ['ArrowDown'],
    NAV_UP: ['ArrowUp'],
    NAV_NEXT_PAGE: ['PageDown', 'j'],
    NAV_PREV_PAGE: ['PageUp', 'k'],
  },
  
  // Feature flags
  FEATURES: {
    ENABLE_SEARCH_SUGGESTIONS: true,
    ENABLE_SEARCH_HISTORY: true,
    ENABLE_RECENT_SEARCHES: true,
    ENABLE_FACETED_SEARCH: true,
    ENABLE_SEARCH_ANALYTICS: true,
    ENABLE_KEYBOARD_SHORTCUTS: true,
    ENABLE_SNIPPET_HIGHLIGHTING: true,
    ENABLE_SEARCH_FILTERS: true,
  },
} as const;

export const SEARCH_RESULT_TYPES = {
  COURSE: 'course',
  MATERIAL: 'material',
  UNIT: 'unit',
  TOPIC: 'topic',
  QUIZ: 'quiz',
  CASE: 'clinical_case',
  USER: 'user',
} as const;

export type SearchResultType = typeof SEARCH_RESULT_TYPES[keyof typeof SEARCH_RESULT_TYPES];

/**
 * Type-to-route mapping for navigation
 */
export const SEARCH_RESULT_ROUTES: Record<SearchResultType, string> = {
  course: '/courses',
  material: '/materials',
  unit: '/units',
  topic: '/topics',
  quiz: '/quiz',
  clinical_case: '/clinical-cases',
  user: '/profile',
};

/**
 * Result type badge colors for UI
 */
export const SEARCH_RESULT_COLORS: Record<SearchResultType, { bg: string; text: string }> = {
  course: { bg: 'bg-blue-100', text: 'text-blue-700' },
  material: { bg: 'bg-orange-100', text: 'text-orange-700' },
  unit: { bg: 'bg-purple-100', text: 'text-purple-700' },
  topic: { bg: 'bg-pink-100', text: 'text-pink-700' },
  quiz: { bg: 'bg-purple-100', text: 'text-purple-700' },
  clinical_case: { bg: 'bg-green-100', text: 'text-green-700' },
  user: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

/**
 * Error messages for common search errors
 */
export const SEARCH_ERROR_MESSAGES: Record<string, string> = {
  MIN_LENGTH: `Query must be at least ${SEARCH_CONFIG.MIN_QUERY_LENGTH} characters`,
  MAX_LENGTH: `Query cannot exceed ${SEARCH_CONFIG.MAX_QUERY_LENGTH} characters`,
  EMPTY_QUERY: 'Please enter a search query',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  TIMEOUT: 'Search took too long. Please try again.',
  SERVER_ERROR: 'Search service unavailable. Please try again later.',
  INVALID_FILTER: 'Invalid search filter',
  RATE_LIMITED: 'Too many requests. Please wait before searching again.',
} as const;
