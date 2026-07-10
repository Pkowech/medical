'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { usePageHeader } from '@/core/providers/HeaderContext';
import materialService from '@/features/courses/services/materialService';
import { aiRecommendationService } from '@/features/analytics/services/aiRecommendationService'; // Implemented AI service
import { Material } from '@/shared/types/materialInterface';
import { MaterialListItem } from './MaterialListItem';
import { MaterialCard } from './MaterialCard';
import { RecommendationCard } from './RecommendationCard'; // New Component
import { Button } from '@/shared/components/ui/button';
import { 
  Search, Plus, LayoutGrid, LayoutList,
  BrainCircuit, Database, BookOpen, Sparkles, Upload, ArrowUpDown
} from 'lucide-react';

interface MaterialsPageData {
  items: Material[];
  total: number;
  page: number;
  pageSize: number;
}

export default function MaterialsDashboard() {
  const { setHeader } = usePageHeader();
  const router = useRouter();
  
  // View State
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterContext, setFilterContext] = useState<'all' | 'enrolled' | 'for_you'>('all');
  const [intentFilter, setIntentFilter] = useState('all'); // Intent-based filter
  
  // Sort State
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Set header - "Knowledge Vault" branding
  useEffect(() => {
    setHeader({
      title: 'Knowledge Vault',
      description: 'Centralized intelligence for your medical mastery',
      icon: <Database className="w-6 h-6 text-indigo-500" />,
    });
    // Only cleanup on unmount
    return () => setHeader(null);
  }, []); // Empty dependency array - set only once on mount

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 1. Fetch Materials (Infinite)
  const pageSize = 20;
  const {
    data: materialsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['materials', debouncedSearch, intentFilter, filterContext, sortBy, sortOrder],
    queryFn: async ({ pageParam = 1 }) => {
      const page = pageParam as number;
      let scope: 'all' | 'enrolled' | 'recommended' | 'owned' = 'all'; // Default to 'all'
      const filter = filterContext as string;
      if (filter === 'enrolled') scope = 'enrolled';
      if (filter === 'for_you') scope = 'recommended'; // This case is handled by a separate query, but kept for type safety
      if (filter === 'favorites') scope = 'all'; // Logic for favs pending, assuming 'all' for now

      return await materialService.getMaterialsPaginated({
        page,
        limit: pageSize,
        search: debouncedSearch,
        type: intentFilter === 'all' ? undefined : intentFilter, 
        scope: scope,
        sortBy,
        sortOrder
      });
    },
    initialPageParam: 1,
    enabled: (filterContext as string) !== 'for_you' && (filterContext as string) !== 'local', // Don't fetch materials list when on "For You" or "Local"
    // Cache settings to avoid UI flicker when refetching or switching tabs
    gcTime: 10 * 60 * 1000, // 10 minutes
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
    getNextPageParam: (lastPage: MaterialsPageData) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.pageSize);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
  });

  // 2. Fetch AI Recommendations (Only for 'For You' tab)
  const { data: recommendations, isLoading: isRecLoading } = useQuery({
    queryKey: ['ai-recommendations'],
    queryFn: async () => await aiRecommendationService.getAISuggestions('current-user'),
    enabled: filterContext === 'for_you',
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const allMaterials = useMemo(
    () => materialsData?.pages.flatMap((page) => page.items) || [],
    [materialsData]
  );
  const totalCount = useMemo(
    () => materialsData?.pages[0]?.total || 0,
    [materialsData]
  );

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return <ArrowUpDown className={`h-3 w-3 ${sortOrder === 'asc' ? 'transform rotate-180' : ''}`} />;
  };

  // Intent Filters Definition
  const intents = [
    { id: 'all', label: 'All Resources' },
    { id: 'lecture_notes', label: 'Lecture Notes' },
    { id: 'clinical_cases', label: 'Clinical Cases' },
    { id: 'revision_packs', label: 'Revision Packs' },
    { id: 'research', label: 'Research Papers' },
  ];

  return (
    <div className="space-y-8 min-h-screen pb-20">
      {/* Top Control Bar */}
      <div className="flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center bg-white dark:bg-slate-900/50 p-1 rounded-3xl">
        
        {/* Context Tabs */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-full xl:w-auto overflow-x-auto">
          {[
            { id: 'all', label: 'Library', icon: Database },
            { id: 'enrolled', label: 'My Courses', icon: BookOpen },
            { id: 'for_you', label: 'For You', icon: Sparkles, highlight: true },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = filterContext === tab.id;
            const isHighlight = tab.highlight;
            
            return (
              <button
                key={tab.id}
                onClick={() => setFilterContext(tab.id as 'all' | 'enrolled' | 'for_you')}
                title={tab.label}
                className={`
                  flex-1 xl:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap
                  ${isActive 
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md shadow-slate-200/50 dark:shadow-none' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }
                  ${!isActive && isHighlight ? 'text-indigo-600 dark:text-indigo-400' : ''}
                `}
              >
                <Icon className={`w-4 h-4 ${isHighlight && !isActive ? 'text-indigo-500 animate-pulse' : ''}`} />
                <span>{tab.label}</span>
                {isHighlight && isActive && (
                   <span className="ml-1 flex h-2 w-2 relative">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                   </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Actions */}
        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
          {((filterContext as string) !== 'for_you' && (filterContext as string) !== 'local') && ( // Hide search for 'local' as well
            <div className="relative flex-1 sm:w-80 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Search knowledge base..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
              />
            </div>
          )}

          <div className="flex gap-3">
             {filterContext !== 'for_you' && (
                <div className="flex items-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-1 shadow-sm">
                  <button
                    onClick={() => setViewMode('list')}
                    title="List view"
                    aria-label="Switch to list view"
                    className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-slate-100 dark:bg-slate-700 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <LayoutList className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    title="Grid view"
                    aria-label="Switch to grid view"
                    className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-slate-100 dark:bg-slate-700 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
             )}

            <Button 
              onClick={() => router.push('/study-planner/materials/upload')} 
              className="h-auto py-3 px-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 rounded-2xl font-bold shadow-xl shadow-slate-900/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </div>
        </div>
      </div>
      
      {/* Intent Filters (Only show on library views) */}
      {filterContext !== 'for_you' && (
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
          {intents.map((intent) => (
            <button
              key={intent.id}
              onClick={() => setIntentFilter(intent.id)}
              className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all whitespace-nowrap ${
                intentFilter === intent.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {intent.label}
            </button>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      {filterContext === 'for_you' ? (
        // --- AI Recommendations View ---
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
              <BrainCircuit className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Curated for your goals</h2>
              <p className="text-sm text-slate-500">Based on your recent performance and study patterns</p>
            </div>
          </div>
          
          {isRecLoading && !recommendations ? (
             <div className="flex justify-center py-20">
               <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-indigo-500" />
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations?.map((rec) => (
                <RecommendationCard key={rec.id} suggestion={rec} />
              ))}
            </div>
          )}
        </div>
      ) : (
        // --- Materials Library View ---
        <>
          {isLoading && !allMaterials.length ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-indigo-500" />
            </div>
          ) : allMaterials.length === 0 ? (
            // Strategic Empty State
            <div className="text-center py-24 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors" onClick={() => router.push('/study-planner/materials/upload')}>
              <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-xl shadow-slate-200/50 dark:shadow-none flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <Upload className="w-10 h-10 text-indigo-500" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Start your Knowledge Vault</h3>
              <p className="text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
                Upload your first material to start tracking mastery. We support PDF, Slides, and Clinical Notes.
              </p>
              <Button onClick={(e) => { e.stopPropagation(); router.push('/study-planner/materials/upload'); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-6 rounded-xl font-bold text-base shadow-lg shadow-indigo-500/20">
                Upload Material
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {totalCount} Resources Found
                </span>
              </div>

              {viewMode === 'list' && (
                 <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                   {/* Table Header */}
                   <div className="hidden sm:flex items-center justify-between p-4 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider backdrop-blur-sm">
                     <div className="flex-1 cursor-pointer hover:text-indigo-600 flex items-center gap-1 transition-colors" onClick={() => handleSort('title')}>
                       Resource Name <SortIcon column="title" />
                     </div>
                     <div className="flex items-center gap-8 mr-12">
                       <div className="w-24 cursor-pointer hover:text-indigo-600 flex items-center gap-1 transition-colors" onClick={() => handleSort('type')}>
                         Format <SortIcon column="type" />
                       </div>
                       <div className="w-20 text-right cursor-pointer hover:text-indigo-600 flex items-center justify-end gap-1 transition-colors" onClick={() => handleSort('size')}>
                         Size <SortIcon column="size" />
                       </div>
                       <div className="w-28 text-right cursor-pointer hover:text-indigo-600 flex items-center justify-end gap-1 transition-colors" onClick={() => handleSort('createdAt')}>
                         Added <SortIcon column="createdAt" />
                       </div>
                       <div className="w-32 text-right">Source</div>
                     </div>
                   </div>

                   {/* Table Body */}
                   <div className="divide-y divide-slate-100 dark:divide-slate-800">
                     {allMaterials.map((material: Material) => (
                       <MaterialListItem 
                         key={material.id} 
                         material={material} 
                         onView={(m: Material) => router.push(`/study-planner/materials/${m.id}`)}
                       />
                     ))}
                   </div>
                 </div>
              )}

              {viewMode === 'grid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {allMaterials.map((material: Material) => (
                    <MaterialCard 
                      key={material.id} 
                      material={material} 
                    />
                  ))}
                </div>
              )}

              {/* Load More */}
              {hasNextPage && (
                <div className="flex justify-center pt-8 pb-4">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="w-full max-w-xs h-12 rounded-xl font-bold border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    {isFetchingNextPage ? 'Loading more...' : 'Load more resources'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
