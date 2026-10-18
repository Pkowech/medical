'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePageHeader } from '@/core/providers/HeaderContext';
import materialService from '@/features/courses/services/materialService';
import { courseService } from '@/features/courses/services/courseService';
import { Material } from '@/shared/types/materialInterface';
import type { Course } from '@/shared/types/courseInterface';
import { MaterialListItem } from './MaterialListItem';
import { MaterialCard } from './MaterialCard';
import { RecommendationCard } from './RecommendationCard'; // New Component
import { Button } from '@/shared/components/ui/button';
import { toast } from 'sonner';
import { 
  Search, Plus, LayoutGrid, LayoutList, ChevronDown,
  BrainCircuit, Database, BookOpen, Sparkles, Upload, FolderOpen,
  CalendarDays, Download, FileText, MoreVertical, UserRound, ArrowLeft
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { getInstructorDisplayName } from '@/lib/utils';

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

const MATERIAL_TYPE_FILTERS = [
  { id: 'all', label: 'All types' },
  { id: 'pdf', label: 'PDFs' },
  { id: 'video', label: 'Videos' },
  { id: 'slide', label: 'Slides' },
  { id: 'quiz_guide', label: 'Quiz guides' },
  { id: 'notes', label: 'Notes' },
  { id: 'audio', label: 'Audio' },
  { id: 'interactive', label: 'Interactive' },
  { id: 'flashcard', label: 'Flashcards' },
  { id: 'other', label: 'Other' },
] as const;

const MATERIALS_SECTION_STATE_KEY = 'medtrack.materials.section-state.v2';

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
  const [materialTypeFilter, setMaterialTypeFilter] = useState('all');
  
  // Sort State
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sectionOpenState, setSectionOpenState] = useState<Record<string, boolean>>({});
  const [hasRestoredSectionState, setHasRestoredSectionState] = useState(false);

  useEffect(() => {
    try {
      const savedState = window.localStorage.getItem(MATERIALS_SECTION_STATE_KEY);
      if (savedState) {
        const parsed: unknown = JSON.parse(savedState);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setSectionOpenState(
            Object.fromEntries(
              Object.entries(parsed).filter((entry): entry is [string, boolean] =>
                typeof entry[1] === 'boolean',
              ),
            ),
          );
        }
      }
    } catch (error) {
      console.warn('Could not restore Materials section state:', error);
    } finally {
      setHasRestoredSectionState(true);
    }
  }, []);

  useEffect(() => {
    if (!hasRestoredSectionState) return;
    try {
      window.localStorage.setItem(
        MATERIALS_SECTION_STATE_KEY,
        JSON.stringify(sectionOpenState),
      );
    } catch (error) {
      console.warn('Could not save Materials section state:', error);
    }
  }, [hasRestoredSectionState, sectionOpenState]);

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

  const {
    data: selectedCourse,
    isLoading: isCourseLoading,
    isError: isCourseError,
    error: courseError,
  } = useQuery<Course, Error>({
    queryKey: ['course', selectedCourseId],
    queryFn: () => courseService.getCourseById(selectedCourseId!),
    enabled: courseFilterInitialized && Boolean(selectedCourseId),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const courseTitle = selectedCourse?.title || selectedCourse?.name;
    setHeader({
      title: selectedCourseId ? courseTitle || 'Course materials' : 'Knowledge Vault',
      description: selectedCourseId
        ? 'Course stream and shared learning materials'
        : 'Centralized intelligence for your medical mastery',
      icon: selectedCourseId
        ? <BookOpen className="h-6 w-6 text-indigo-500" />
        : <Database className="h-6 w-6 text-indigo-500" />,
    });
    return () => setHeader(null);
  }, [selectedCourseId, selectedCourse?.title, selectedCourse?.name, setHeader]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 1. Fetch Materials (Infinite)
  const pageSize = 20;
  const {
    data: materialsData,
    isLoading,
    isError: isMaterialsError,
    error: materialsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['materials', debouncedSearch, materialTypeFilter, filterContext, selectedCourseId, sortBy, sortOrder],
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
        type: materialTypeFilter === 'all' ? undefined : materialTypeFilter,
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
  const materialSectionStates = useMemo(() => {
    const sections: Array<{ id: string; defaultOpen: boolean }> = [];
    for (const course of organizedMaterials.courses) {
      sections.push({ id: `course:${course.id}`, defaultOpen: false });
      for (const unit of course.units) {
        sections.push({
          id: `unit:${course.id}:${unit.id}`,
          defaultOpen: false,
        });
        for (const topic of unit.topics) {
          sections.push({
            id: `topic:${course.id}:${unit.id}:${topic.id}`,
            defaultOpen: false,
          });
        }
      }
    }
    if (organizedMaterials.unassigned.length > 0) {
      sections.push({ id: 'personal-unassigned', defaultOpen: false });
    }
    return sections;
  }, [organizedMaterials]);
  const allMaterialSectionsOpen =
    materialSectionStates.length > 0 &&
    materialSectionStates.every(
      section => sectionOpenState[section.id] ?? section.defaultOpen,
    );

  const isSectionOpen = (id: string, defaultOpen: boolean) =>
    sectionOpenState[id] ?? defaultOpen;

  const handleSectionToggle = (
    id: string,
    event: React.SyntheticEvent<HTMLDetailsElement>,
  ) => {
    const isOpen = event.currentTarget.open;
    setSectionOpenState(previous =>
      previous[id] === isOpen ? previous : { ...previous, [id]: isOpen },
    );
  };

  const setAllMaterialSectionsOpen = (open: boolean) => {
    setSectionOpenState(previous => ({
      ...previous,
      ...Object.fromEntries(materialSectionStates.map(section => [section.id, open])),
    }));
  };

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
    <div className="divide-y divide-border dark:divide-border">
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

  const formatStreamDate = (date?: string) => {
    if (!date) return 'Date not available';
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return 'Date not available';
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: parsedDate.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    }).format(parsedDate);
  };

  const courseInstructor = selectedCourse
    ? getInstructorDisplayName(selectedCourse.instructor ?? selectedCourse.createdBy)
    : '';
  const courseBannerPalettes = [
    'from-slate-600 via-slate-600 to-slate-800',
    'from-blue-700 via-blue-700 to-indigo-900',
    'from-teal-700 via-cyan-700 to-slate-800',
    'from-violet-700 via-indigo-700 to-slate-800',
  ];
  const coursePaletteIndex = selectedCourseId
    ? Array.from(selectedCourseId).reduce((sum, character) => sum + character.charCodeAt(0), 0) % courseBannerPalettes.length
    : 0;

  const contextTitle = filterContext === 'owned'
    ? 'My materials'
    : filterContext === 'shared'
      ? 'Shared materials'
      : 'Recommended review';
  const contextDescription = filterContext === 'owned'
    ? 'Keep your study resources organized by course, unit, and topic.'
    : filterContext === 'shared'
      ? 'Materials available to you from your courses and classmates.'
      : 'Review resources selected to help strengthen topics from your recent quiz results.';

  return (
    <div className="mx-auto min-h-full w-full max-w-screen-2xl min-w-0 space-y-6 pb-20">
      {/* Library heading and controls */}
      {!selectedCourseId && (
        <section className="space-y-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Study library</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground dark:text-foreground">
                {contextTitle}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground dark:text-muted-foreground">
                {contextDescription}
              </p>
            </div>
            {filterContext !== 'for_you' && (
              <Button
                onClick={() => router.push('/study-planner/materials/upload')}
                className="h-10 shrink-0 gap-2 rounded-lg bg-blue-600 px-4 text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add material
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-3 shadow-sm dark:border-border dark:bg-card sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex w-full flex-wrap gap-1 rounded-lg bg-muted p-1 dark:bg-card lg:w-auto">
                {[
                  { id: 'owned', label: 'My Drive', icon: Database },
                  { id: 'shared', label: 'Shared with me', icon: BookOpen },
                  { id: 'for_you', label: 'For You', icon: Sparkles },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = filterContext === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        setFilterContext(tab.id as 'owned' | 'shared' | 'for_you');
                        if (tab.id !== 'shared') {
                          setSelectedCourseId(undefined);
                          router.replace('/study-planner/materials');
                        }
                      }}
                      className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:flex-none ${
                        isActive
                          ? 'bg-card text-blue-700 shadow-sm dark:bg-secondary dark:text-blue-300'
                          : 'text-muted-foreground hover:bg-card/70 hover:text-foreground dark:text-muted-foreground dark:hover:bg-secondary/70 dark:hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex min-w-0 flex-col gap-2 sm:flex-row lg:flex-1 lg:justify-end">
                {filterContext !== 'for_you' && (
                  <div className="group relative min-w-0 flex-1 sm:max-w-sm">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-blue-600" />
                    <input
                      type="search"
                      aria-label="Search materials by title, content, course, unit, or topic"
                      placeholder="Search title, course, unit, topic…"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-border dark:bg-background dark:text-foreground dark:focus:ring-blue-950"
                    />
                  </div>
                )}

                {filterContext !== 'for_you' && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="materials-sort" className="sr-only">Sort materials</label>
                    <select
                      id="materials-sort"
                      value={sortBy === 'title' ? 'title' : sortOrder === 'asc' ? 'oldest' : 'newest'}
                      onChange={(event) => {
                        const value = event.target.value;
                        setSortBy(value === 'title' ? 'title' : 'createdAt');
                        setSortOrder(value === 'oldest' || value === 'title' ? 'asc' : 'desc');
                      }}
                      className="h-10 min-w-28 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-border dark:bg-background dark:text-muted-foreground dark:focus:ring-blue-950"
                    >
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                      <option value="title">A–Z</option>
                    </select>
                    <div className="flex h-10 items-center rounded-lg border border-border bg-card p-1 dark:border-border dark:bg-background">
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        aria-label="Switch to list view"
                        aria-pressed={viewMode === 'list'}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          viewMode === 'list' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'text-muted-foreground hover:bg-muted dark:text-muted-foreground dark:hover:bg-card'
                        }`}
                      >
                        <LayoutList className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        aria-label="Switch to grid view"
                        aria-pressed={viewMode === 'grid'}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          viewMode === 'grid' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'text-muted-foreground hover:bg-muted dark:text-muted-foreground dark:hover:bg-card'
                        }`}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {selectedCourseId && (
        <section className="mx-auto w-full max-w-5xl space-y-5">
          <button
            type="button"
            onClick={() => {
              setSelectedCourseId(undefined);
              setFilterContext('shared');
              router.replace('/study-planner/materials');
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-blue-700 dark:text-muted-foreground dark:hover:text-blue-300"
          >
            <ArrowLeft className="h-4 w-4" />
            All materials
          </button>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm dark:border-border dark:bg-card">
            {isCourseLoading ? (
              <div className="h-44 animate-pulse bg-secondary dark:bg-card" />
            ) : isCourseError ? (
              <div role="alert" className="p-6 text-sm text-rose-700 dark:text-rose-300">
                Could not load course details: {courseError instanceof Error ? courseError.message : 'Please try again later.'}
              </div>
            ) : (
              <>
                <div className={`relative flex min-h-44 items-end overflow-hidden bg-gradient-to-br ${courseBannerPalettes[coursePaletteIndex]} px-6 py-6 text-white sm:px-8`}>
                  <BookOpen className="absolute -bottom-10 -right-3 h-48 w-48 rotate-[-12deg] text-white/10 sm:h-56 sm:w-56" aria-hidden="true" />
                  <div className="relative min-w-0 max-w-3xl">
                    {selectedCourse?.code && (
                      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/75">
                        {selectedCourse.code}
                      </p>
                    )}
                    <h1 className="line-clamp-2 text-2xl font-medium leading-tight sm:text-3xl">
                      {selectedCourse?.title || selectedCourse?.name || 'Course materials'}
                    </h1>
                    {courseInstructor && (
                      <p className="mt-2 text-sm text-white/85">{courseInstructor}</p>
                    )}
                  </div>
                </div>
                <div className="border-t border-border bg-muted px-6 py-3 text-sm text-muted-foreground dark:border-border dark:bg-card dark:text-muted-foreground sm:px-8">
                  {selectedCourse?.category?.name || selectedCourse?.description || 'Course learning materials'}
                </div>
                <nav aria-label="Course sections" className="flex items-center gap-7 border-t border-border px-5 dark:border-border sm:px-8">
                  <a
                    href="#course-stream"
                    aria-current="page"
                    className="border-b-2 border-blue-600 py-3 text-sm font-semibold text-blue-700 dark:text-blue-300"
                  >
                    Stream
                  </a>
                  <button
                    type="button"
                    onClick={() => router.push(`/courses/${selectedCourseId}`)}
                    className="border-b-2 border-transparent py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground"
                  >
                    Classwork
                  </button>
                  <a
                    href="#course-people"
                    className="border-b-2 border-transparent py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground"
                  >
                    People
                  </a>
                </nav>
              </>
            )}
          </div>

          {isCourseError ? null : (
            <div id="course-stream" className="grid grid-cols-1 items-start gap-5 md:grid-cols-[minmax(170px,0.75fr)_minmax(0,2.5fr)]">
              <aside className="space-y-4">
                <section className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border dark:bg-card">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground dark:text-muted-foreground">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    Upcoming
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground">
                    No upcoming work has been added.
                  </p>
                </section>
                <section id="course-people" className="scroll-mt-6 rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border dark:bg-card">
                  <h2 className="text-sm font-semibold text-muted-foreground dark:text-muted-foreground">Instructor</h2>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      <UserRound className="h-4 w-4" />
                    </span>
                    <p className="min-w-0 truncate text-sm text-muted-foreground dark:text-muted-foreground">
                      {courseInstructor || 'Instructor information unavailable'}
                    </p>
                  </div>
                </section>
              </aside>

              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                  <h2 className="text-base font-semibold text-muted-foreground dark:text-muted-foreground">Class stream</h2>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <label htmlFor="course-material-search" className="sr-only">
                      Search course materials by title, content, unit, or topic
                    </label>
                    <input
                      id="course-material-search"
                      type="search"
                      placeholder="Search this course…"
                      value={searchTerm}
                      onChange={event => setSearchTerm(event.target.value)}
                      className="h-9 w-full min-w-0 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-border dark:bg-background dark:text-foreground dark:focus:ring-blue-950 sm:w-52"
                    />
                    <label htmlFor="course-material-type" className="sr-only">
                      Filter course materials by resource type
                    </label>
                    <select
                      id="course-material-type"
                      value={materialTypeFilter}
                      onChange={event => setMaterialTypeFilter(event.target.value)}
                      className="h-9 min-w-28 rounded-lg border border-border bg-card px-2 text-sm text-muted-foreground outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-border dark:bg-background dark:text-muted-foreground dark:focus:ring-blue-950"
                    >
                      {MATERIAL_TYPE_FILTERS.map(filter => (
                        <option key={filter.id} value={filter.id}>
                          {filter.label}
                        </option>
                      ))}
                    </select>
                    <span className="shrink-0 text-sm text-muted-foreground dark:text-muted-foreground">
                      {totalCount} {totalCount === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                </div>

                {(!courseFilterInitialized || isLoading) && !allMaterials.length ? (
                  <div className="space-y-3" aria-label="Loading course materials">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="h-20 animate-pulse rounded-xl bg-muted dark:bg-card" />
                    ))}
                  </div>
                ) : isMaterialsError ? (
                  <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                    Could not load course materials: {materialsError instanceof Error ? materialsError.message : 'Please try again later.'}
                  </div>
                ) : allMaterials.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center dark:border-border dark:bg-card">
                    <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground" />
                    <h3 className="mt-3 font-semibold text-muted-foreground dark:text-muted-foreground">
                      {debouncedSearch || materialTypeFilter !== 'all'
                        ? 'No matching materials'
                        : 'No materials in this stream yet'}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">
                      {debouncedSearch || materialTypeFilter !== 'all'
                        ? 'Try another search or resource type.'
                        : 'Materials shared with this class will appear here.'}
                    </p>
                    {(debouncedSearch || materialTypeFilter !== 'all') && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSearchTerm('');
                          setDebouncedSearch('');
                          setMaterialTypeFilter('all');
                        }}
                        className="mt-4 rounded-lg"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                ) : (
                  allMaterials.map((material) => {
                    const ownerName = material.user
                      ? [material.user.firstName, material.user.lastName].filter(Boolean).join(' ')
                      : material.author || courseInstructor || 'Course instructor';
                    const fileUrl = material.fileUrl || material.url;

                    return (
                      <article
                        key={material.id}
                        className="flex min-h-20 items-center gap-3 rounded-xl border border-border bg-muted px-3 py-3 transition-colors hover:bg-secondary/70 dark:border-border dark:bg-card/80 dark:hover:bg-card sm:gap-4 sm:px-4"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
                          <FileText className="h-5 w-5" />
                        </span>
                        <button
                          type="button"
                          onClick={() => router.push(`/study-planner/materials/${material.id}`)}
                          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <p className="line-clamp-2 text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                            <span className="font-semibold">{ownerName}</span>
                            {' posted a new material: '}
                            <span>{material.title}</span>
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground">
                            {formatStreamDate(material.uploadDate || material.createdAt)}
                          </p>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Options for ${material.title}`}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground"
                            >
                              <MoreVertical className="h-5 w-5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => router.push(`/study-planner/materials/${material.id}`)}>
                              Open material
                            </DropdownMenuItem>
                            {fileUrl && (
                              <DropdownMenuItem onSelect={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')}>
                                <Download className="mr-2 h-4 w-4" />
                                Open file
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </article>
                    );
                  })
                )}

                {hasNextPage && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="rounded-lg"
                    >
                      {isFetchingNextPage ? 'Loading more…' : 'Show older materials'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}
      
      {/* Material type filters (only show on library views) */}
      {!selectedCourseId && filterContext !== 'for_you' && (
        <section aria-label="Filter by resource type" className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">
            Resource type
          </h2>
          <div className="flex min-w-0 flex-wrap gap-2">
          {MATERIAL_TYPE_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setMaterialTypeFilter(filter.id)}
              aria-pressed={materialTypeFilter === filter.id}
              className={`min-h-9 rounded-full border px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                materialTypeFilter === filter.id
                  ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
                  : 'border-border bg-card text-muted-foreground hover:border-blue-300 hover:bg-blue-50 dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:border-blue-800 dark:hover:bg-card'
              }`}
            >
              {filter.label}
            </button>
          ))}
          </div>
        </section>
      )}

      {/* Main Content Area */}
      {!selectedCourseId && (filterContext === 'for_you' ? (
        // --- AI Recommendations View ---
        <div className="min-w-0 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
              <BrainCircuit className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground dark:text-foreground">Curated for your goals</h2>
              <p className="text-sm text-muted-foreground">Matched to topics where your recorded quiz scores show room to improve</p>
            </div>
          </div>
          
          {isRecLoading && !recommendations ? (
             <div className="flex justify-center py-20">
               <div className="animate-spin rounded-full h-12 w-12 border-4 border-border border-t-indigo-500" />
             </div>
          ) : isRecError ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              Could not load your recommendations: {recommendationError instanceof Error ? recommendationError.message : 'Please try again later.'}
            </div>
          ) : recommendations?.length ? (
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {recommendations.map((rec) => (
                <RecommendationCard key={rec.id} suggestion={rec} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center dark:border-border dark:bg-card">
              <h3 className="font-semibold text-foreground dark:text-foreground">No targeted review suggestions yet</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                Recommendations appear when recorded quiz scores identify a topic below 70% and there is a matching course, unit, or topic resource that you own or can access through sharing.
              </p>
            </div>
          )}
        </div>
      ) : (
        // --- Materials Library View ---
        <div className="min-w-0 space-y-5">
          {(!courseFilterInitialized || isLoading) && !allMaterials.length ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-border border-t-indigo-500" />
            </div>
          ) : isMaterialsError ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              Could not load materials: {materialsError instanceof Error ? materialsError.message : 'Please try again later.'}
            </div>
          ) : allMaterials.length === 0 ? (
            // Strategic Empty State
            <div className="rounded-xl border border-dashed border-border bg-card px-5 py-16 text-center dark:border-border dark:bg-card">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                <Upload className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground dark:text-foreground">
                {debouncedSearch || materialTypeFilter !== 'all'
                  ? 'No matching materials'
                  : filterContext === 'shared' ? 'Nothing shared with you yet' : 'Your library is ready'}
              </h3>
              <p className="mx-auto mt-2 mb-6 max-w-md text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground">
                {debouncedSearch || materialTypeFilter !== 'all'
                  ? 'Try a different search or clear the resource type filter.'
                  : filterContext === 'shared'
                  ? 'Materials shared directly with you or with one of your classes will appear here.'
                  : 'Add a study resource or connect it to one of your courses to keep everything organized.'}
              </p>
              {debouncedSearch || materialTypeFilter !== 'all' ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setDebouncedSearch('');
                    setMaterialTypeFilter('all');
                  }}
                  className="rounded-lg"
                >
                  Clear filters
                </Button>
              ) : filterContext !== 'shared' ? (
                <Button onClick={() => router.push('/study-planner/materials/upload')} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                  Add material
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 dark:border-border">
                <span className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                  {totalCount} {totalCount === 1 ? 'resource' : 'resources'}
                </span>
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                  {debouncedSearch && (
                    <span className="max-w-full truncate text-xs text-muted-foreground dark:text-muted-foreground">
                      Results for “{debouncedSearch}”
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAllMaterialSectionsOpen(!allMaterialSectionsOpen)}
                    disabled={materialSectionStates.length === 0}
                    className="h-9 shrink-0 rounded-lg"
                  >
                    {allMaterialSectionsOpen ? 'Collapse all' : 'Expand all'}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {organizedMaterials.courses.map((course) => (
                  <details
                    key={course.id}
                    open={isSectionOpen(`course:${course.id}`, false)}
                    onToggle={event => handleSectionToggle(`course:${course.id}`, event)}
                    className="group/course overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border dark:bg-card"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3.5 marker:hidden transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:hover:bg-card/60 sm:gap-4 sm:px-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                          <BookOpen className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-foreground dark:text-foreground">{course.title}</h3>
                          <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                            {course.units.length} {course.units.length === 1 ? 'unit' : 'units'} · {course.resourceCount} {course.resourceCount === 1 ? 'resource' : 'resources'}
                          </p>
                        </div>
                      </div>
                      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/course:rotate-180 dark:text-muted-foreground" />
                    </summary>
                    <div className="space-y-3 border-t border-border px-3 py-3 dark:border-border sm:px-5">
                      {course.units.map((unit) => {
                        const unitResourceCount = unit.materials.length
                          + unit.topics.reduce((count, topic) => count + topic.materials.length, 0);

                        return (
                          <details
                            key={unit.id}
                            open={isSectionOpen(`unit:${course.id}:${unit.id}`, false)}
                            onToggle={event =>
                              handleSectionToggle(`unit:${course.id}:${unit.id}`, event)
                            }
                            className="group/unit overflow-hidden rounded-lg border border-border dark:border-border"
                          >
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 marker:hidden transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:hover:bg-card/60">
                              <h4 className="min-w-0 flex-1 break-words text-sm font-medium text-muted-foreground dark:text-muted-foreground">{unit.title}</h4>
                              <span className="shrink-0 text-xs text-muted-foreground dark:text-muted-foreground">
                                {unitResourceCount} {unitResourceCount === 1 ? 'resource' : 'resources'}
                              </span>
                              <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/unit:rotate-180 dark:text-muted-foreground" />
                            </summary>
                            <div className="space-y-3 border-t border-border p-3 dark:border-border">
                              {unit.materials.length > 0 && renderMaterialItems(unit.materials)}
                              {unit.topics.map((topic) => (
                                <details
                                  key={topic.id}
                                  open={isSectionOpen(
                                    `topic:${course.id}:${unit.id}:${topic.id}`,
                                    false,
                                  )}
                                  onToggle={event =>
                                    handleSectionToggle(
                                      `topic:${course.id}:${unit.id}:${topic.id}`,
                                      event,
                                    )
                                  }
                                  className="group/topic overflow-hidden rounded-md border border-border dark:border-border"
                                >
                                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:hidden transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:hover:bg-card/60">
                                    <h5 className="min-w-0 flex-1 break-words text-xs font-medium text-muted-foreground dark:text-muted-foreground">{topic.title}</h5>
                                    <span className="shrink-0 text-xs text-muted-foreground dark:text-muted-foreground">
                                      {topic.materials.length} {topic.materials.length === 1 ? 'resource' : 'resources'}
                                    </span>
                                    <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/topic:rotate-180 dark:text-muted-foreground" />
                                  </summary>
                                  <div className="border-t border-border dark:border-border">
                                    {renderMaterialItems(topic.materials)}
                                  </div>
                                </details>
                              ))}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </details>
                ))}

                {organizedMaterials.unassigned.length > 0 && (
                  <details
                    open={isSectionOpen('personal-unassigned', false)}
                    onToggle={event => handleSectionToggle('personal-unassigned', event)}
                    className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border dark:bg-card"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 marker:hidden transition-colors hover:bg-background dark:hover:bg-card/60 sm:px-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground dark:bg-card dark:text-muted-foreground">
                          <FolderOpen className="h-5 w-5" />
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground dark:text-foreground">Personal &amp; unassigned</h3>
                          <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                            {organizedMaterials.unassigned.length} resources not linked to a course
                          </p>
                        </div>
                      </div>
                      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 dark:text-muted-foreground" />
                    </summary>
                    {viewMode === 'list' ? (
                      <div className="divide-y divide-border border-t border-border dark:divide-border dark:border-border">
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
                      <div className="grid grid-cols-1 gap-4 border-t border-border p-4 sm:grid-cols-2 xl:grid-cols-3 dark:border-border">
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
                    className="w-full max-w-xs h-12 rounded-xl font-bold border-border dark:border-border hover:bg-background dark:hover:bg-card transition-all"
                  >
                    {isFetchingNextPage ? 'Loading more...' : 'Load more resources'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
