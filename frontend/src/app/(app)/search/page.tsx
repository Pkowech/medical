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
      <SearchResults initialQuery={query} initialFilter={filter} />
    </ProtectedRoute>
  );
}
