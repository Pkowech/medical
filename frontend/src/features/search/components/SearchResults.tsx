'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearch, SearchResult } from '@/features/search/hooks/useSearch';
import Link from 'next/link';

interface SearchResultsProps {
  initialQuery?: string;
  initialFilter?: string;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  initialQuery = '',
  initialFilter = 'all',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState(initialFilter);
  const [page, setPage] = useState(1);
  const limit = 20;
  const { results, total, loading, search, facets, expandedQuery, synonymsMatched } = useSearch();
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Clear item refs when results change
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, results.length);
  }, [results]);

  useEffect(() => {
    search(query, filter, page, limit);
  }, [query, filter, page, search]);

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

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
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
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Medical Search</h1>
        <p className="text-gray-500 italic">Access your structured curriculum with professional-grade intelligence.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Facets */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Categories</h3>
            <div className="space-y-1">
              {['all', 'course', 'unit', 'topic', 'material', 'quiz', 'case', 'user'].map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFilter(f);
                    setPage(1);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                    filter === f 
                      ? 'bg-blue-50 text-blue-700 font-semibold' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="capitalize">{f === 'all' ? 'All Results' : f.replace('_', ' ')}</span>
                  {f === 'all' ? (
                    <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-md font-bold">{total}</span>
                  ) : (
                    facets[f] !== undefined && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                        filter === f ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {facets[f]}
                      </span>
                    )
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
            <h4 className="font-bold mb-2">Medical Intelligence</h4>
            <p className="text-xs text-blue-100 leading-relaxed">
              Our search uses Bayesian logic and medical synonym expansion to ensure you find exactly what you need, even if terms differ.
            </p>
          </div>
        </div>

        {/* Search Content */}
        <div className="lg:col-span-3">
          <div className="relative mb-6">
            <input
              id="search-input"
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setPage(1);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Search for courses, materials, subjects..."
              className="w-full px-6 py-4 text-lg rounded-2xl border-none shadow-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 transition-all bg-white"
            />
            {loading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>

          {expandedQuery && expandedQuery !== query && (
            <div className="mb-6 px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center gap-3">
              <div className="bg-indigo-100 p-1.5 rounded-lg">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-sm text-indigo-800">
                Expanded search: <span className="font-semibold italic text-indigo-900">{expandedQuery}</span>
              </span>
            </div>
          )}

          <div className="mb-4 flex justify-between items-center px-2">
            <div className="text-sm text-gray-500">
              Found <span className="font-bold text-gray-900">{total}</span> results
            </div>
          </div>

          <div className="space-y-4" onKeyDown={handleListKeyDown}>
            {results.map((r, idx) => {
              let href = `/profile/${r.id}`;
              if (r.type === 'course') href = `/courses/${r.id}`;
              else if (r.type === 'material') href = `/materials/${r.id}`;
              else if (r.type === 'unit') href = `/units/${r.id}`;
              else if (r.type === 'topic') href = `/topics/${r.id}`;
              else if (r.type === 'quiz') href = `/quiz/${r.id}`;
              else if (r.type === 'case') href = `/clinical-cases/${r.id}`;

              return (
                <div key={`${r.type}-${r.id}`} className="group relative bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-100 transition-all">
                  <Link href={href} className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                            r.type === 'course' ? 'bg-blue-100 text-blue-700' :
                            r.type === 'material' ? 'bg-orange-100 text-orange-700' :
                            r.type === 'quiz' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {r.type}
                          </span>
                          {r.relevance > 0.8 && (
                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">High Match</span>
                          )}
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {r.title}
                        </h2>
                      </div>
                      <div className="bg-gray-50 p-2 rounded-xl group-hover:bg-blue-50 transition-colors">
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                    
                    {/* Use snippet if available (with highlights), otherwise description */}
                    <div 
                      className="text-gray-600 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ 
                        __html: (r as any).snippet || r.description || '' 
                      }}
                    />
                  </Link>
                </div>
              );
            })}

            {results.length === 0 && !loading && (
              <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <div className="text-gray-400 mb-2">No matches found for your query.</div>
                <p className="text-sm text-gray-500">Try broadening your search or using medical terminology.</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
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
        </div>
      </div>
    </div>
  );
};
