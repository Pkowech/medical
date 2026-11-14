'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearch } from '@/features/search/hooks/useSearch';
import Link from 'next/link';
import { AlertCircle, RotateCcw, Search as SearchIcon, X } from 'lucide-react';
import { formatSearchMetrics, getRelevanceLevel, getRelevanceColorClasses, isRetryableError } from '@/features/search/utils/searchUtils';
import { sanitizeHtml } from '@/lib/utils/sanitizeHtml';
import { SEARCH_CONFIG } from '@/features/search/config/searchConfig';

interface SearchResultsProps {
  initialQuery?: string;
  initialFilter?: string;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  initialQuery = '',
  initialFilter = 'all',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [filter, setFilter] = useState(initialFilter);
  const [page, setPage] = useState(1);
  const limit = 20;
  const { results, total, loading, search, facets, expandedQuery, error, retry, metrics } = useSearch();
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const isRetryable = error && isRetryableError(error.code);
  const isDebouncing = query.trim() !== debouncedQuery.trim();
  const isSearchPending = isDebouncing || loading;
  const queryIsLongEnough = query.trim().length >= SEARCH_CONFIG.MIN_QUERY_LENGTH;

  // Clear item refs when results change
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, results.length);
  }, [results]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), SEARCH_CONFIG.DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    search(debouncedQuery, filter, page, limit);
  }, [debouncedQuery, filter, page, search]);

  useEffect(() => {
    setFocusedIndex(null);
  }, [query, filter, page]);

  // Keyboard navigation: focus management
  const focusItem = useCallback((index: number) => {
    const el = itemRefs.current[index];
    if (el) {
      el.focus();
      setFocusedIndex(index);
    }
  }, []);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault();
      focusItem(0);
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = focusedIndex === null ? 0 : Math.min(results.length - 1, focusedIndex + 1);
      focusItem(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = focusedIndex === null ? results.length - 1 : Math.max(0, focusedIndex - 1);
      focusItem(prev);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-7">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground">Search</h1>
        <p className="text-muted-foreground">Find courses, learning materials, topics, and more.</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-4">
        {/* Sidebar Facets */}
        <aside aria-label="Search filters" className="space-y-5 lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filter by type</h2>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {['all', 'course', 'unit', 'topic', 'material', 'quiz', 'case', 'user'].map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => {
                    setFilter(f);
                    setPage(1);
                  }}
                  className={`flex min-h-10 shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:w-full ${
                    filter === f
                      ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="capitalize">{f === 'all' ? 'All Results' : f.replace('_', ' ')}</span>
                  {f === 'all' ? (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums">{total}</span>
                  ) : (
                    facets[f] !== undefined && (
                      <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                        filter === f ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-muted text-muted-foreground'
                      }`}>
                        {facets[f]}
                      </span>
                    )
                  )}
                </button>
              ))}
            </div>
          </div>

        </aside>

        {/* Search Content */}
        <section aria-label="Search results" className="min-w-0 lg:col-span-3">
          <div className="relative mb-5">
            <SearchIcon aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              id="search-input"
              type="text"
              value={query}
              maxLength={SEARCH_CONFIG.MAX_QUERY_LENGTH}
              aria-label="Search courses, materials, subjects, and more"
              onChange={e => {
                setQuery(e.target.value);
                setPage(1);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Search courses, materials, subjects..."
              className="min-h-14 w-full rounded-xl border border-input bg-card py-3 pl-12 pr-12 text-base text-foreground shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setPage(1);
                }}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
            {isSearchPending && queryIsLongEnough && (
              <div className="sr-only" role="status" aria-live="polite">
                Searching...
              </div>
            )}
          </section>

          {expandedQuery && expandedQuery !== debouncedQuery && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900 dark:bg-indigo-950/30">
              <div className="rounded-lg bg-indigo-100 p-1.5 dark:bg-indigo-900/60">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-sm text-indigo-800">
                Expanded search: <span className="font-semibold italic text-indigo-900 dark:text-indigo-200">{expandedQuery}</span>
              </span>
            </div>
          )}

          {/* Error Recovery Card */}
          {error && (
            <div className="mb-6 px-6 py-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">Search Error</h3>
                <p className="text-sm text-red-800 dark:text-red-300 mb-3">{error.message}</p>
                {isRetryable && (
                  <button
                    onClick={() => retry()}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Retry Search
                  </button>
                )}
              </div>
            </div>
          )}

          {query && (
            <div className="mb-4 flex min-h-6 items-center justify-between gap-3 text-sm text-muted-foreground" aria-live="polite">
              <p>
                {isSearchPending ? (
                  'Searching...'
                ) : queryIsLongEnough ? (
                  <>
                    {total === 0 ? 'No results' : `Showing ${results.length} of ${total} results`}
                    {metrics?.totalTime ? <span className="ml-2">· {formatSearchMetrics(metrics.totalTime).display}</span> : null}
                  </>
                ) : (
                  `Enter at least ${SEARCH_CONFIG.MIN_QUERY_LENGTH} characters to search.`
                )}
              </p>
              {query.length >= SEARCH_CONFIG.MAX_QUERY_LENGTH - 20 && (
                <span className="shrink-0 text-xs tabular-nums">
                  {query.length}/{SEARCH_CONFIG.MAX_QUERY_LENGTH}
                </span>
              )}
            </div>
          )}

          <div className="space-y-4" onKeyDown={handleListKeyDown}>
            {!query && (
              <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
                <SearchIcon aria-hidden="true" className="mx-auto mb-4 h-9 w-9 text-muted-foreground/60" />
                <h2 className="mb-1 text-lg font-semibold text-foreground">Start searching</h2>
                <p className="text-sm text-muted-foreground">Search across courses, materials, topics, and clinical cases.</p>
              </div>
            )}

            {queryIsLongEnough && !isSearchPending && results.map((r, idx) => {
              let href = `/profile/${r.id}`;
              if (r.type === 'course') href = `/courses/${r.id}`;
              else if (r.type === 'material') href = `/materials/${r.id}`;
              else if (r.type === 'unit') href = `/units/${r.id}`;
              else if (r.type === 'topic') href = `/topics/${r.id}`;
              else if (r.type === 'quiz') href = '/assessment';
              else if (r.type === 'case' || r.type === 'clinical_case') href = `/clinical-cases/${r.id}`;

              const relevanceLevel = getRelevanceLevel(r.relevance);
              const relevanceColors = getRelevanceColorClasses(r.relevance);

              return (
                <div 
                  key={`${r.type}-${r.id}`} 
                  className={`group relative rounded-xl border bg-card p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md ${relevanceColors.border || 'border-border'}`}
                >
                  <Link 
                    ref={el => { if (el) itemRefs.current[idx] = el; }}
                    href={href} 
                    className="flex flex-col gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label={`${r.title} - ${r.type}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                            r.type === 'course' ? 'bg-blue-100 text-blue-700' :
                            r.type === 'material' ? 'bg-orange-100 text-orange-700' :
                            r.type === 'quiz' ? 'bg-purple-100 text-purple-700' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {r.type}
                          </span>
                          {r.relevance > 0.8 && (
                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest px-2 py-0.5 bg-green-50 rounded-md">High Match</span>
                          )}
                          {/* Relevance badge */}
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${relevanceColors.bg}`}>
                            <span className={relevanceColors.text}>{relevanceLevel}</span>
                          </span>
                        </div>
                        <h2 className="text-xl font-bold text-foreground group-hover:text-blue-600 transition-colors">
                          {r.title}
                        </h2>
                      </div>
                      <div className="bg-background p-2 rounded-xl group-hover:bg-blue-50 transition-colors">
                        <svg className="w-5 h-5 text-muted-foreground group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                    
                    {/* Use snippet if available (with highlights), otherwise description */}
                    <div 
                      className="text-muted-foreground text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ 
                        __html: sanitizeHtml(((r as unknown as { snippet?: string }).snippet) || r.description || '')
                      }}
                      role="region"
                      aria-label={`Content preview for ${r.title}`}
                    />
                  </Link>
                </div>
              );
            })}

            {isSearchPending && queryIsLongEnough && (
              <div className="rounded-xl border border-border bg-card px-6 py-12 text-center" role="status" aria-live="polite">
                <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-blue-600" />
                <p className="text-sm text-muted-foreground">Searching your learning library...</p>
              </div>
            )}

            {queryIsLongEnough && results.length === 0 && !isSearchPending && !error && (
              <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
                <SearchIcon aria-hidden="true" className="mx-auto mb-4 h-9 w-9 text-muted-foreground/60" />
                <h2 className="mb-1 text-lg font-semibold text-foreground">No results found</h2>
                <p className="text-sm text-muted-foreground">Try a different term, check your spelling, or choose another type.</p>
              </div>
            )}

            {!queryIsLongEnough && query.length > 0 && (
              <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">Keep typing to search. Enter at least {SEARCH_CONFIG.MIN_QUERY_LENGTH} characters.</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {queryIsLongEnough && !isSearchPending && total > limit && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing page {page} of {Math.ceil(total / limit)}
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                  aria-label="Previous page"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil(total / limit), p + 1))}
                  disabled={page >= Math.ceil(total / limit)}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
