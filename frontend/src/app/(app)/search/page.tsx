'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { SearchResults } from '@/features/search/components/SearchResults';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('query') || '';
  const filter = searchParams.get('filter') || 'all';

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Search Results for "{query}"</h1>
        <SearchResults initialQuery={query} initialFilter={filter} />
      </div>
    </ProtectedRoute>
  );
}
