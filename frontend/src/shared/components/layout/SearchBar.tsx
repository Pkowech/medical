'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FaSearch } from 'react-icons/fa';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { useSearch, SearchResult } from '@/features/search/hooks/useSearch';

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { results, loading, search, clearSearch } = useSearch();

  // Debounce search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        search(query);
      } else {
        clearSearch();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, search, clearSearch]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
  };

  const getHref = (result: SearchResult) => {
    switch (result.type) {
      case 'course': return `/courses/${result.id}`;
      case 'material': return `/materials/${result.id}`;
      case 'quiz': return `/quizzes/${result.id}`;
      case 'unit': return `/units/${result.id}`;
      case 'topic': return `/topics/${result.id}`;
      case 'case': return `/materials/clinical-cases/${result.id}`;
      case 'user': return `/profile/${result.id}`;
      default: return '#';
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'course': return 'bg-blue-100 text-blue-700';
      case 'quiz': return 'bg-purple-100 text-purple-700';
      case 'case': return 'bg-green-100 text-green-700';
      case 'material': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="relative w-full max-w-2xl" ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Search by course name, subject, or year..."
          className="w-full px-4 py-3 pl-12 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors bg-white shadow-sm"
        />
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
          {loading ? (
            <AiOutlineLoading3Quarters className="animate-spin text-blue-500 h-4 w-4" />
          ) : (
            <FaSearch className="text-gray-400 h-4 w-4" />
          )}
        </div>
      </div>

      {isOpen && (results.length > 0 || (query.length >= 2 && !loading)) && (
        <div className="absolute mt-2 w-full bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 overflow-hidden max-h-[400px] overflow-y-auto">
          {results.length > 0 ? (
            results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => {
                  router.push(getHref(result));
                  setIsOpen(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center justify-between group transition-colors border-b border-gray-50 last:border-0"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                    {result.title}
                  </div>
                  {result.description && (
                    <div className="text-xs text-gray-500 truncate mt-0.5">
                      {result.description}
                    </div>
                  )}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${getBadgeColor(result.type)}`}>
                  {result.type}
                </span>
              </button>
            ))
          ) : query.length >= 2 ? (
            <div className="px-4 py-8 text-center">
              <div className="text-gray-400 mb-1">No results found for "{query}"</div>
              <div className="text-xs text-gray-500 italic">Try different keywords or check spelling</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
