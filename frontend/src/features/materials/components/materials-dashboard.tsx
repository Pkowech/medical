'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePageHeader } from '@/core/providers/HeaderContext';
import materialService from '@/features/courses/services/materialService';
import { Material } from '@/shared/types/materialInterface';
import { MaterialListItem } from './MaterialListItem';
import { MaterialCard } from './MaterialCard';
import { RecommendationCard } from './RecommendationCard'; // New Component
import { Button } from '@/shared/components/ui/button';
import { toast } from 'sonner';
import { 
  Search, Plus, LayoutGrid, LayoutList, ChevronDown, X,
  BrainCircuit, Database, BookOpen, Sparkles, Upload, FolderOpen
} from 'lucide-react';

interface MaterialsPageData {
  items: Material[];
  total: number;
  page: number;
  pageSize: number;
}

interface MaterialUnitGroup {
  id: string;
  title: string;
  order: number;
  materials: Material[];
  topics: Array<{
    id: string;
    title: string;
    order: number;
    materials: Material[];
  }>;
}

interface MaterialCourseGroup {
  id: string;
  title: string;
  units: MaterialUnitGroup[];
  resourceCount: number;
}

export default function MaterialsDashboard() {
  const { setHeader } = usePageHeader();
  const router = useRouter();
  
  // View State
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterContext, setFilterContext] = useState<'owned' | 'shared' | 'for_you'>('owned');
  const [selectedCourseId, setSelectedCourseId] = useState<string>();
  const [courseFilterInitialized, setCourseFilterInitialized] = useState(false);
  const [sharingMaterialIds, setSharingMaterialIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('courseId') || undefined;
    const requestedScope = params.get('scope');
    setSelectedCourseId(courseId);
    if (courseId || requestedScope === 'enrolled' || requestedScope === 'shared') {
      setFilterContext('shared');
    }
    setCourseFilterInitialized(true);
  }, []);

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
    queryKey: ['materials', debouncedSearch, intentFilter, filterContext, selectedCourseId, sortBy, sortOrder],
    queryFn: async ({ pageParam = 1 }) => {
      const page = pageParam as number;
      const scope = selectedCourseId
        ? 'enrolled'
        : filterContext === 'owned'
          ? 'owned'
          : 'shared';

      return await materialService.getMaterialsPaginated({
        page,
        limit: pageSize,
        search: debouncedSearch,
        type: intentFilter === 'all' ? undefined : intentFilter, 
        scope: scope,
        courseId: selectedCourseId,
        sortBy,
        sortOrder
      });
    },
    initialPageParam: 1,
    enabled: courseFilterInitialized && filterContext !== 'for_you',
    // Cache settings to avoid UI flicker when refetching or switching tabs
    gcTime: 10 * 60 * 1000, // 10 minutes
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    getNextPageParam: (lastPage: MaterialsPageData) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.pageSize);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
  });

  // 2. Fetch AI Recommendations (Only for 'For You' tab)
  const {
    data: recommendations,
    isLoading: isRecLoading,
    isError: isRecError,
    error: recommendationError,
  } = useQuery({
    queryKey: ['material-recommendations'],
    queryFn: () => materialService.getRecommendedMaterials(),
    enabled: filterContext === 'for_you',
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  const allMaterials = useMemo(
    () => materialsData?.pages.flatMap((page) => page.items) || [],
    [materialsData]
  );
  const totalCount = useMemo(
    () => materialsData?.pages[0]?.total || 0,
    [materialsData]
  );
  const organizedMaterials = useMemo(() => {
    const courses = new Map<string, MaterialCourseGroup>();
    const unassigned: Material[] = [];

    for (const material of allMaterials) {
      const course = material.course ?? material.unit?.course;
      const courseId = course?.id ?? material.courseId;
      if (!courseId) {
        unassigned.push(material);
        continue;
      }

      let courseGroup = courses.get(courseId);
      if (!courseGroup) {
        courseGroup = {
          id: courseId,
          title: course?.title || course?.name || 'Course materials',
          units: [],
          resourceCount: 0,
        };
        courses.set(courseId, courseGroup);
      }
      courseGroup.resourceCount += 1;

      const unitId = material.unitId ? String(material.unitId) : 'course-resources';
      let unitGroup = courseGroup.units.find((unit) => unit.id === unitId);
      if (!unitGroup) {
        unitGroup = {
          id: unitId,
          title: material.unit?.title || material.unit?.name || 'Course resources',
          order: material.unit?.order ?? Number.MAX_SAFE_INTEGER,
          materials: [],
          topics: [],
        };
        courseGroup.units.push(unitGroup);
      }
      if (material.topicId || material.topic) {
        const topicId = material.topic?.id || material.topicId || 'topic';
        let topicGroup = unitGroup.topics.find((topic) => topic.id === topicId);
        if (!topicGroup) {
          topicGroup = {
            id: topicId,
            title: material.topic?.name || 'Topic materials',
            order: material.topic?.order ?? Number.MAX_SAFE_INTEGER,
            materials: [],
          };
          unitGroup.topics.push(topicGroup);
        }
        topicGroup.materials.push(material);
      } else {
        unitGroup.materials.push(material);
      }
    }

    return {
      courses: Array.from(courses.values())
        .map((course) => ({
          ...course,
          units: course.units
            .map((unit) => ({
              ...unit,
              topics: unit.topics.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
            }))
            .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
        }))
        .sort((a, b) => a.title.localeCompare(b.title)),
      unassigned,
    };
  }, [allMaterials]);

  const toggleCourseSharing = async (material: Material) => {
    if (!material.unitId) {
      toast.error('Assign this material to a course and unit before sharing it with a class.');
      return;
    }

    const shared = material.metadata?.shareWithCourse === false;
    setSharingMaterialIds((current) => new Set(current).add(material.id));
    try {
      await materialService.setCourseSharing(material.id, shared);
      await queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast.success(shared ? 'Material shared with the class.' : 'Material is private from the class.');
    } catch (error) {
      console.error('Could not update material sharing:', error);
      toast.error(error instanceof Error ? error.message : 'Could not update sharing.');
    } finally {
      setSharingMaterialIds((current) => {
        const next = new Set(current);
        next.delete(material.id);
        return next;
      });
    }
  };

  const renderMaterialItems = (materials: Material[]) => viewMode === 'list' ? (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {materials.map((material) => (
        <MaterialListItem
          key={material.id}
          material={material}
          canManageSharing={filterContext === 'owned' && !sharingMaterialIds.has(material.id)}
          onToggleCourseSharing={toggleCourseSharing}
          onView={(item) => router.push(`/study-planner/materials/${item.id}`)}
        />
      ))}
    </div>
  ) : (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {materials.map((material) => (
        <MaterialCard
          key={material.id}
          material={material}
          canManageSharing={filterContext === 'owned' && !sharingMaterialIds.has(material.id)}
          onToggleCourseSharing={toggleCourseSharing}
        />
      ))}
    </div>
  );

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
            { id: 'owned', label: 'My Drive', icon: Database },
            { id: 'shared', label: 'Shared with me', icon: BookOpen },
            { id: 'for_you', label: 'For You', icon: Sparkles, highlight: true },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = filterContext === tab.id;
            const isHighlight = tab.highlight;
            
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setFilterContext(tab.id as 'owned' | 'shared' | 'for_you');
                  if (tab.id !== 'shared') {
                    setSelectedCourseId(undefined);
                    router.replace('/study-planner/materials');
                  }
                }}
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
               <select
                 aria-label="Sort materials"
                 value={sortBy === 'title' ? 'title' : sortOrder === 'asc' ? 'oldest' : 'newest'}
                 onChange={(event) => {
                   const value = event.target.value;
                   setSortBy(value === 'title' ? 'title' : 'createdAt');
                   setSortOrder(value === 'oldest' || value === 'title' ? 'asc' : 'desc');
                 }}
                 className="rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
               >
                 <option value="newest">Newest</option>
                 <option value="oldest">Oldest</option>
                 <option value="title">A–Z</option>
               </select>
             )}
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

        {selectedCourseId && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/30">
            <div className="flex min-w-0 items-center gap-2 text-sm text-indigo-900 dark:text-indigo-100">
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span className="truncate font-semibold">Showing this course&apos;s materials</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedCourseId(undefined);
                setFilterContext('shared');
                router.replace('/study-planner/materials');
              }}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
              Clear course
            </button>
          </div>
        )}
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
              <p className="text-sm text-slate-500">Matched to topics where your recorded quiz scores show room to improve</p>
            </div>
          </div>
          
          {isRecLoading && !recommendations ? (
             <div className="flex justify-center py-20">
               <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-indigo-500" />
             </div>
          ) : isRecError ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              Could not load your recommendations: {recommendationError instanceof Error ? recommendationError.message : 'Please try again later.'}
            </div>
          ) : recommendations?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations.map((rec) => (
                <RecommendationCard key={rec.id} suggestion={rec} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
              <h3 className="font-semibold text-slate-900 dark:text-white">No targeted review suggestions yet</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                Recommendations appear when quiz results identify a topic below 70% and there is a material for that topic that you own or can access through sharing.
              </p>
            </div>
          )}
        </div>
      ) : (
        // --- Materials Library View ---
        <>
          {(!courseFilterInitialized || isLoading) && !allMaterials.length ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-indigo-500" />
            </div>
          ) : allMaterials.length === 0 ? (
            // Strategic Empty State
            <div className="text-center py-24 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors" onClick={() => router.push('/study-planner/materials/upload')}>
              <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-xl shadow-slate-200/50 dark:shadow-none flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <Upload className="w-10 h-10 text-indigo-500" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {filterContext === 'shared' ? 'Nothing shared with you yet' : 'Start your Knowledge Vault'}
              </h3>
              <p className="text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
                {filterContext === 'shared'
                  ? 'Materials shared directly with you or with one of your classes will appear here.'
                  : 'Upload materials to My Drive, organize them by course and unit, and choose whether to share them with a class.'}
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

              <div className="space-y-4">
                {organizedMaterials.courses.map((course) => (
                  <details key={course.id} open className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 bg-gradient-to-r from-slate-50 to-white px-5 py-4 marker:hidden dark:from-slate-800 dark:to-slate-900">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                          <BookOpen className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate font-bold text-slate-900 dark:text-white">{course.title}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {course.units.length} {course.units.length === 1 ? 'unit' : 'units'} · {course.resourceCount} {course.resourceCount === 1 ? 'resource' : 'resources'}
                          </p>
                        </div>
                      </div>
                      <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-3 border-t border-slate-100 p-4 dark:border-slate-800">
                      {course.units.map((unit) => (
                        <section key={unit.id} className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{unit.title}</h4>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {unit.materials.length + unit.topics.reduce((count, topic) => count + topic.materials.length, 0)} resources
                            </span>
                          </div>
                          {unit.materials.length > 0 && (
                            <div className="border-t border-slate-100 dark:border-slate-800">
                              <h5 className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Unit resources</h5>
                              {renderMaterialItems(unit.materials)}
                            </div>
                          )}
                          {unit.topics.map((topic) => (
                            <details key={topic.id} className="group/topic border-t border-slate-100 dark:border-slate-800">
                              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{topic.title}</span>
                                <span className="flex items-center gap-2 text-xs text-slate-500">
                                  {topic.materials.length} {topic.materials.length === 1 ? 'resource' : 'resources'}
                                  <ChevronDown className="h-4 w-4 transition-transform group-open/topic:rotate-180" />
                                </span>
                              </summary>
                              {renderMaterialItems(topic.materials)}
                            </details>
                          ))}
                        </section>
                      ))}
                    </div>
                  </details>
                ))}

                {organizedMaterials.unassigned.length > 0 && (
                  <details open className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:hidden">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <FolderOpen className="h-5 w-5" />
                        </span>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white">Personal &amp; unassigned</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {organizedMaterials.unassigned.length} resources not linked to a course
                          </p>
                        </div>
                      </div>
                      <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                    </summary>
                    {viewMode === 'list' ? (
                      <div className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                        {organizedMaterials.unassigned.map((material) => (
                          <MaterialListItem
                            key={material.id}
                            material={material}
                            canManageSharing={filterContext === 'owned' && !sharingMaterialIds.has(material.id)}
                            onToggleCourseSharing={toggleCourseSharing}
                            onView={(item) => router.push(`/study-planner/materials/${item.id}`)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 border-t border-slate-100 p-4 sm:grid-cols-2 xl:grid-cols-3 dark:border-slate-800">
                        {organizedMaterials.unassigned.map((material) => (
                          <MaterialCard
                            key={material.id}
                            material={material}
                            canManageSharing={filterContext === 'owned' && !sharingMaterialIds.has(material.id)}
                            onToggleCourseSharing={toggleCourseSharing}
                          />
                        ))}
                      </div>
                    )}
                  </details>
                )}
              </div>

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
