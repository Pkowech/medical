'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { useAuth } from '@/features/auth/hooks/useAuth';
import materialService from '@/features/courses/services/materialService';
import { courseService } from '@/features/courses/services/courseService';
import { apiService } from '@/features/auth/services/apiClient';
import scheduleService from '@/features/learning-management/study/services/scheduleService';
import { learningPathService } from '@/features/learning-management/services/learningPathService';
import { Material } from '@/shared/types/materialInterface';
import type { Course } from '@/shared/types/courseInterface';
import type { LearningPathProgress } from '@/shared/types/learningInterface';
import type { ScheduleEvent } from '@/shared/types/studyInterface';
import { MaterialListItem } from './MaterialListItem';
import { MaterialCard } from './MaterialCard';
import { RecommendationCard } from './RecommendationCard'; // New Component
import { Button } from '@/shared/components/ui/button';
import { toast } from 'sonner';
import { 
  Search, Plus, LayoutGrid, LayoutList, ChevronDown, CheckCircle2,
  BrainCircuit, Database, BookOpen, Sparkles, Upload, FolderOpen,
  ArrowLeft, Clock, Layers, Play, CalendarClock, Target, Route
} from 'lucide-react';
import { getInstructorDisplayName } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

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

interface RoadmapGoal {
  id: string;
  title: string;
  status: string;
  targetDate: string;
  progressPercentage?: number;
  course?: { id: string; title?: string };
  learningPath?: { id: string; title?: string };
  courseId?: string;
  learningPathId?: string;
  relatedCourse?: string;
  relatedLearningPath?: string;
}

interface RoadmapDeadline {
  id: string;
  title: string;
  dueDate: string;
  courseId?: string;
  unitId?: string;
  priority?: string;
}

interface RoadmapDueItem {
  id: string;
  title: string;
  dueDate: string;
  progressPercentage?: number;
}

interface RoadmapTopicSelection {
  title: string;
  unitTitle: string;
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

const localDateTimeValue = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const getCourseRoadmapEvents = async (courseId: string): Promise<ScheduleEvent[]> => {
  const now = new Date();
  const monthAhead = new Date(now);
  monthAhead.setDate(monthAhead.getDate() + 30);
  let payload: unknown = await apiService.get<unknown>('/events', {
    params: { startDate: now.toISOString(), endDate: monthAhead.toISOString() },
  });

  for (let depth = 0; depth < 3; depth += 1) {
    if (Array.isArray(payload)) break;
    if (!payload || typeof payload !== 'object') break;
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.items)) {
      payload = record.items;
      break;
    }
    if (Array.isArray(record.events)) {
      payload = record.events;
      break;
    }
    if ('data' in record) {
      payload = record.data;
      continue;
    }
    break;
  }

  if (!Array.isArray(payload)) {
    throw new Error('The schedule events response was invalid.');
  }

  return payload.flatMap((item): ScheduleEvent[] => {
    if (!item || typeof item !== 'object') return [];
    const event = item as Record<string, unknown>;
    const description = typeof event.description === 'string' ? event.description : '';
    if (!description.includes(`[courseId:${courseId}]`)) return [];
    const dateValue = event.date ?? event.startDate;
    if (
      typeof dateValue !== 'string'
      && typeof dateValue !== 'number'
      && !(dateValue instanceof Date)
    ) {
      return [];
    }
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return [];
    const endDateValue = event.endDate;
    const endDate = typeof endDateValue === 'string'
      || typeof endDateValue === 'number'
      || endDateValue instanceof Date
      ? new Date(endDateValue)
      : date;
    return [{
      id: typeof event.id === 'string' ? event.id : `${courseId}-${date.getTime()}`,
      title: typeof event.title === 'string' ? event.title : 'Course study session',
      description,
      date,
      endDate: Number.isNaN(endDate.getTime()) ? date : endDate,
      type: typeof event.type === 'string' ? event.type : 'study',
    }];
  });
};

export default function MaterialsDashboard() {
  const { setHeader } = usePageHeader();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
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
  const [topicToSchedule, setTopicToSchedule] = useState<RoadmapTopicSelection | null>(null);
  const [scheduledStart, setScheduledStart] = useState(() => {
    const nextHour = new Date();
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    if (nextHour.getHours() >= 22) {
      nextHour.setDate(nextHour.getDate() + 1);
      nextHour.setHours(9);
    }
    return localDateTimeValue(nextHour);
  });
  const [isScheduling, setIsScheduling] = useState(false);

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

  const requestedCourseId = searchParams.get('courseId') || undefined;
  const requestedScope = searchParams.get('scope');

  useEffect(() => {
    setSelectedCourseId(requestedCourseId);
    if (requestedScope === 'owned') {
      setFilterContext('owned');
    } else if (requestedCourseId || requestedScope === 'enrolled' || requestedScope === 'shared') {
      setFilterContext('shared');
    }
    setCourseFilterInitialized(true);
  }, [requestedCourseId, requestedScope]);

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
  const {
    data: activeGoals = [],
    isLoading: goalsLoading,
    isError: goalsError,
    refetch: refetchGoals,
  } = useQuery<RoadmapGoal[], Error>({
    queryKey: ['course-roadmap-goals', user?.id, selectedCourseId],
    queryFn: async () => {
      const response = await apiService.get<unknown>('/learning-goals', {
        params: { status: 'active', limit: 100 },
      });
      let payload: unknown = response;
      for (let depth = 0; depth < 3; depth += 1) {
        if (Array.isArray(payload)) return payload as RoadmapGoal[];
        if (!payload || typeof payload !== 'object' || !('data' in payload)) break;
        payload = payload.data;
      }
      if (!Array.isArray(payload)) {
        throw new Error('The active goals response was invalid.');
      }
      return payload as RoadmapGoal[];
    },
    enabled: Boolean(user?.id && selectedCourseId),
    staleTime: 60 * 1000,
  });
  const {
    data: learningPathProgress = [],
    isLoading: learningPathsLoading,
    isError: learningPathsError,
    refetch: refetchLearningPaths,
  } = useQuery<LearningPathProgress[], Error>({
    queryKey: ['course-roadmap-learning-paths', user?.id],
    queryFn: () => learningPathService.getMyProgress(),
    enabled: Boolean(user?.id && selectedCourseId),
    staleTime: 2 * 60 * 1000,
  });
  const {
    data: courseDeadlines = [],
    isLoading: deadlinesLoading,
    isError: deadlinesError,
    refetch: refetchDeadlines,
  } = useQuery<RoadmapDeadline[], Error>({
    queryKey: ['course-roadmap-deadlines', user?.id, selectedCourseId],
    queryFn: async () => {
      const response = await apiService.get<unknown>('/deadlines');
      let payload: unknown = response;
      for (let depth = 0; depth < 3; depth += 1) {
        if (Array.isArray(payload)) return payload as RoadmapDeadline[];
        if (!payload || typeof payload !== 'object' || !('data' in payload)) break;
        payload = payload.data;
      }
      if (!Array.isArray(payload)) {
        throw new Error('The course deadlines response was invalid.');
      }
      return payload as RoadmapDeadline[];
    },
    enabled: Boolean(user?.id && selectedCourseId),
    staleTime: 60 * 1000,
  });
  const {
    data: upcomingStudySessions = [],
    isLoading: scheduleLoading,
    isError: scheduleError,
    refetch: refetchSchedule,
  } = useQuery({
    queryKey: ['course-roadmap-schedule', user?.id, selectedCourseId],
    queryFn: () => {
      if (!selectedCourseId) {
        throw new Error('A course is required to load its scheduled sessions.');
      }
      return getCourseRoadmapEvents(selectedCourseId);
    },
    enabled: Boolean(user?.id && selectedCourseId),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    const courseTitle = selectedCourse?.title || selectedCourse?.name;
    setHeader({
      title: selectedCourseId ? 'Course roadmap' : 'Knowledge Vault',
      description: selectedCourseId
        ? courseTitle || 'Follow your course units and topics'
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
        ? requestedScope === 'owned' ? 'owned' : 'enrolled'
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

      const materialUnitId = material.unitId ?? material.unit?.id;
      const unitId = materialUnitId != null ? String(materialUnitId) : 'course-resources';
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

  const setSectionOpen = (id: string, isOpen: boolean) => {
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
    if (!material.courseId && !material.course?.id && !material.unitId && !material.unit?.course?.id) {
      toast.error('Assign this material to a course before sharing it with a class.');
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
          canManageSharing={
            filterContext === 'owned' &&
            Boolean(material.courseId || material.course?.id || material.unitId || material.unit?.course?.id) &&
            !sharingMaterialIds.has(material.id)
          }
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
          canManageSharing={
            filterContext === 'owned' &&
            Boolean(material.courseId || material.course?.id || material.unitId || material.unit?.course?.id) &&
            !sharingMaterialIds.has(material.id)
          }
          onToggleCourseSharing={toggleCourseSharing}
        />
      ))}
    </div>
  );

  const courseInstructor = selectedCourse
    ? getInstructorDisplayName(selectedCourse.instructor ?? selectedCourse.createdBy)
    : '';
  const courseUnits = selectedCourse?.units ?? [];
  const courseTopicCount = courseUnits.reduce(
    (count, unit) => count + (unit.topics?.length ?? 0),
    0,
  );
  const getMaterialUnitId = (material: Material) =>
    material.unitId ?? material.unit?.id;
  const getMaterialTopicId = (material: Material) =>
    material.topicId ?? material.topic?.id;
  const courseLevelMaterials = allMaterials.filter(
    material => !getMaterialUnitId(material),
  );
  const matchingLearningPaths = learningPathProgress.filter(progress => {
    if (progress.status === 'completed') return false;
    const path = progress.learningPath;
    const courseIsInPath = path.courses.some(course => {
      if (!course || typeof course !== 'object') return false;
      const record = course as Record<string, unknown>;
      return record.id === selectedCourseId || record.courseId === selectedCourseId;
    });
    const courseIsInPathModule = path.pathStructure?.phases.some(phase =>
      phase.modules.some(module =>
        module.type === 'course' && module.resourceId === selectedCourseId,
      ),
    ) ?? false;
    return courseIsInPath || courseIsInPathModule;
  });
  const matchingPathIds = new Set(matchingLearningPaths.map(progress => progress.learningPath.id));
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueSoonLimit = new Date(startOfToday);
  dueSoonLimit.setDate(dueSoonLimit.getDate() + 7);
  dueSoonLimit.setHours(23, 59, 59, 999);
  const overdueLimit = new Date(startOfToday);
  overdueLimit.setDate(overdueLimit.getDate() - 7);
  const dueSoonGoals = activeGoals.filter(goal => {
    if (goal.status !== 'active') return false;
    const courseMatches =
      goal.course?.id === selectedCourseId
      || goal.courseId === selectedCourseId
      || goal.relatedCourse === selectedCourseId;
    const goalPathId = goal.learningPath?.id ?? goal.learningPathId ?? goal.relatedLearningPath;
    const pathMatches = Boolean(goalPathId && matchingPathIds.has(goalPathId));
    const dueDate = new Date(
      /^\d{4}-\d{2}-\d{2}$/.test(goal.targetDate)
        ? `${goal.targetDate}T00:00:00`
        : goal.targetDate,
    );
    return (courseMatches || pathMatches)
      && !Number.isNaN(dueDate.getTime())
      && dueDate >= overdueLimit
      && dueDate <= dueSoonLimit;
  }).sort((first, second) =>
    new Date(first.targetDate).getTime() - new Date(second.targetDate).getTime(),
  );
  const courseUnitIds = new Set(courseUnits.map(unit => String(unit.id)));
  const dueSoonDeadlines = courseDeadlines.filter(deadline => {
    const date = new Date(deadline.dueDate);
    const isForCourse = deadline.courseId === selectedCourseId
      || Boolean(deadline.unitId && courseUnitIds.has(deadline.unitId));
    return isForCourse
      && !Number.isNaN(date.getTime())
      && date >= overdueLimit
      && date <= dueSoonLimit;
  }).sort((first, second) =>
    new Date(first.dueDate).getTime() - new Date(second.dueDate).getTime(),
  );
  const dueSoonItems: RoadmapDueItem[] = [
    ...dueSoonGoals.map(goal => ({
      id: `goal:${goal.id}`,
      title: goal.title,
      dueDate: goal.targetDate,
      progressPercentage: goal.progressPercentage,
    })),
    ...dueSoonDeadlines.map(deadline => ({
      id: `deadline:${deadline.id}`,
      title: deadline.title,
      dueDate: deadline.dueDate,
    })),
  ].sort((first, second) =>
    new Date(first.dueDate).getTime() - new Date(second.dueDate).getTime(),
  );
  const courseStudySessions = upcomingStudySessions.filter(event =>
    event.description?.includes(`[courseId:${selectedCourseId}]`)
    && event.date >= now
    && event.date <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  ).sort((first, second) => first.date.getTime() - second.date.getTime());

  const scheduleTopicStudy = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourse || !topicToSchedule) return;
    const startDate = new Date(scheduledStart);
    if (Number.isNaN(startDate.getTime()) || startDate <= new Date()) {
      toast.error('Choose a future date and time for this study session.');
      return;
    }

    setIsScheduling(true);
    try {
      await scheduleService.createEvent({
        title: `Study: ${selectedCourse.title || selectedCourse.name} — ${topicToSchedule.title}`,
        description: `Study session for ${topicToSchedule.title} in ${topicToSchedule.unitTitle}. [courseId:${selectedCourse.id}]`,
        date: startDate,
        endDate: new Date(startDate.getTime() + 45 * 60 * 1000),
        type: 'study',
        location: 'Study Planner',
      });
      await queryClient.invalidateQueries({
        queryKey: ['course-roadmap-schedule', user?.id, selectedCourse.id],
      });
      toast.success('Study session added to your schedule.');
      setTopicToSchedule(null);
    } catch (error) {
      console.error('Could not schedule roadmap study session:', error);
      toast.error(error instanceof Error ? error.message : 'Could not add this session to your schedule.');
    } finally {
      setIsScheduling(false);
    }
  };
  const openTopicScheduler = (title: string, unitTitle: string) => {
    const nextHour = new Date();
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    if (nextHour.getHours() >= 22) {
      nextHour.setDate(nextHour.getDate() + 1);
      nextHour.setHours(9);
    }
    setScheduledStart(localDateTimeValue(nextHour));
    setTopicToSchedule({ title, unitTitle });
  };

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
        <section className="mx-auto w-full max-w-screen-xl space-y-5">
          <button
            type="button"
            onClick={() => {
              setSelectedCourseId(undefined);
              setFilterContext(requestedScope === 'owned' ? 'owned' : 'shared');
              router.replace('/study-planner/materials');
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-blue-700 dark:hover:text-blue-300"
          >
            <ArrowLeft className="h-4 w-4" />
            All materials
          </button>

          {isCourseLoading ? (
            <div className="h-48 animate-pulse rounded-2xl bg-muted dark:bg-card" aria-label="Loading course" />
          ) : isCourseError ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              Could not load course details: {courseError instanceof Error ? courseError.message : 'Please try again later.'}
            </div>
          ) : selectedCourse ? (
            <>
              <section className="overflow-hidden rounded-2xl border border-border bg-card dark:border-border dark:bg-card">
                <div className="p-5 sm:p-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      {selectedCourse.category?.name || 'Category unavailable'}
                    </span>
                    {selectedCourse.code && (
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">
                        {selectedCourse.code}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl dark:text-foreground">
                        {selectedCourse.title || selectedCourse.name}
                      </h1>
                      {selectedCourse.description && (
                        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground">
                          {selectedCourse.description}
                        </p>
                      )}
                      {courseInstructor && (
                        <p className="mt-3 text-sm text-muted-foreground dark:text-muted-foreground">
                          Instructor · {courseInstructor}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={() => router.push(`/courses/${selectedCourse.id}`)}
                      className="shrink-0 gap-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <Play className="h-4 w-4" />
                      Continue learning
                    </Button>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-sm text-muted-foreground dark:border-border dark:text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      {courseUnits.length} {courseUnits.length === 1 ? 'unit' : 'units'}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      {courseTopicCount} {courseTopicCount === 1 ? 'topic' : 'topics'}
                    </span>
                    <span>{totalCount} {totalCount === 1 ? 'resource' : 'resources'}</span>
                    {selectedCourse.estimatedHours != null && (
                      <span className="inline-flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {selectedCourse.estimatedHours} study hours
                      </span>
                    )}
                    {typeof selectedCourse.progressPercentage === 'number' && (
                      <span>{Math.round(selectedCourse.progressPercentage)}% complete</span>
                    )}
                  </div>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-3" aria-label="Course learning connections">
                <div className="rounded-xl border border-border bg-card p-4 dark:border-border dark:bg-card">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground dark:text-foreground">
                      <Target className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      Due soon
                    </h2>
                    <Link href="/study-planner/goals" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">
                      All goals
                    </Link>
                  </div>
                  {goalsError && (
                    <div className="mt-3 text-sm text-rose-700 dark:text-rose-300" role="alert">
                      Could not load course goals.{' '}
                      <button type="button" className="underline" onClick={() => void refetchGoals()}>
                        Retry
                      </button>
                    </div>
                  )}
                  {deadlinesError && (
                    <div className="mt-3 text-sm text-rose-700 dark:text-rose-300" role="alert">
                      Could not load course deadlines.{' '}
                      <button type="button" className="underline" onClick={() => void refetchDeadlines()}>
                        Retry
                      </button>
                    </div>
                  )}
                  {goalsLoading || deadlinesLoading ? (
                    <p className="mt-3 text-sm text-muted-foreground dark:text-muted-foreground" role="status">
                      Loading course goals and deadlines…
                    </p>
                  ) : goalsError || deadlinesError ? (
                    <p className="mt-3 text-sm text-muted-foreground dark:text-muted-foreground">
                      Some course due dates may be missing because a source could not be loaded.
                    </p>
                  ) : dueSoonItems.length > 0 ? (
                    <ul className="mt-3 space-y-3">
                      {dueSoonItems.slice(0, 5).map(item => {
                        const dueDate = new Date(
                              /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)
                                ? `${item.dueDate}T00:00:00`
                                : item.dueDate,
                            );
                        return (
                          <li key={item.id} className="border-t border-border pt-3 first:border-0 first:pt-0 dark:border-border">
                            <p className="text-sm font-medium text-foreground dark:text-foreground">{item.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground">
                              {dueDate < startOfToday ? 'Overdue since' : 'Due'} {dueDate.toLocaleDateString()}
                              {typeof item.progressPercentage === 'number' && ` · ${Math.round(item.progressPercentage)}% complete`}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground dark:text-muted-foreground">
                      No course goals or deadlines are overdue or due in the next 7 days.{' '}
                      <Link href="/study-planner/goals" className="font-medium text-blue-700 hover:underline dark:text-blue-300">
                        Set a goal
                      </Link>
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-card p-4 dark:border-border dark:bg-card">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground dark:text-foreground">
                      <Route className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      Learning paths
                    </h2>
                    <Link href="/learning-paths" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">
                      Browse paths
                    </Link>
                  </div>
                  {learningPathsError ? (
                    <div className="mt-3 text-sm text-rose-700 dark:text-rose-300" role="alert">
                      Could not load learning paths.{' '}
                      <button type="button" className="underline" onClick={() => void refetchLearningPaths()}>
                        Retry
                      </button>
                    </div>
                  ) : learningPathsLoading ? (
                    <p className="mt-3 text-sm text-muted-foreground dark:text-muted-foreground" role="status">
                      Loading learning paths…
                    </p>
                  ) : matchingLearningPaths.length > 0 ? (
                    <ul className="mt-3 space-y-3">
                      {matchingLearningPaths.slice(0, 3).map(progress => {
                        const path = progress.learningPath;
                        const currentPhase = path.pathStructure?.phases[progress.currentPhaseIndex];
                        const currentModule = currentPhase?.modules[progress.currentModuleIndex];
                        return (
                          <li key={progress.id} className="border-t border-border pt-3 first:border-0 first:pt-0 dark:border-border">
                            <Link
                              href={`/learning-paths/${encodeURIComponent(path.id)}`}
                              className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
                            >
                              {path.title}
                            </Link>
                            <p className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground">
                              {Math.round(progress.overallProgressPercentage)}% complete
                              {currentModule ? ` · Next: ${currentModule.title}` : currentPhase ? ` · ${currentPhase.title}` : ''}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground dark:text-muted-foreground">
                      No enrolled learning path includes this course yet.{' '}
                      <Link href="/learning-paths" className="font-medium text-blue-700 hover:underline dark:text-blue-300">
                        Explore learning paths
                      </Link>
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-card p-4 dark:border-border dark:bg-card">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground dark:text-foreground">
                      <CalendarClock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Scheduled study
                    </h2>
                    <Link href="/study-planner/schedule" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">
                      Open schedule
                    </Link>
                  </div>
                  {scheduleLoading ? (
                    <p className="mt-3 text-sm text-muted-foreground dark:text-muted-foreground" role="status">
                      Loading scheduled study…
                    </p>
                  ) : courseStudySessions.length > 0 ? (
                    <ul className="mt-3 space-y-3">
                      {courseStudySessions.slice(0, 3).map(session => (
                        <li key={session.id} className="border-t border-border pt-3 first:border-0 first:pt-0 dark:border-border">
                          <p className="text-sm font-medium text-foreground dark:text-foreground">{session.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground">
                            {session.date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground dark:text-muted-foreground">
                      No upcoming study sessions for this course. Schedule one from any topic below.
                    </p>
                  )}
                  {scheduleError && (
                    <p className="mt-2 text-xs text-rose-700 dark:text-rose-300" role="alert">
                      Could not refresh your schedule.{' '}
                      <button type="button" className="underline" onClick={() => void refetchSchedule()}>
                        Retry
                      </button>
                    </p>
                  )}
                </div>
              </section>

              <section className="space-y-4" aria-labelledby="course-roadmap-heading">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 id="course-roadmap-heading" className="text-xl font-semibold text-foreground dark:text-foreground">
                      Learning roadmap
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">
                      Work through each unit and open its topics to study or review linked resources.
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                    <label htmlFor="course-material-search" className="sr-only">
                      Search course resources
                    </label>
                    <input
                      id="course-material-search"
                      type="search"
                      placeholder="Search resources…"
                      value={searchTerm}
                      onChange={event => setSearchTerm(event.target.value)}
                      className="h-10 min-w-0 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:bg-background dark:focus:ring-blue-950 sm:w-56"
                    />
                    <label htmlFor="course-material-type" className="sr-only">
                      Filter resources by type
                    </label>
                    <select
                      id="course-material-type"
                      value={materialTypeFilter}
                      onChange={event => setMaterialTypeFilter(event.target.value)}
                      className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground outline-none focus:border-blue-500 dark:bg-background dark:text-muted-foreground sm:w-36"
                    >
                      {MATERIAL_TYPE_FILTERS.map(filter => (
                        <option key={filter.id} value={filter.id}>{filter.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {courseLevelMaterials.length > 0 && (
                  <section className="overflow-hidden rounded-xl border border-border bg-card dark:bg-card">
                    <h3 className="px-4 pt-4 text-sm font-semibold text-foreground dark:text-foreground">
                      Course resources
                    </h3>
                    {renderMaterialItems(courseLevelMaterials)}
                  </section>
                )}
                {courseUnits.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center dark:bg-card">
                    <h3 className="font-semibold text-foreground dark:text-foreground">No units in this course yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">
                      Course units and topics will appear here when they are added to the curriculum.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {courseUnits.map((unit, unitIndex) => {
                      const unitId = String(unit.id);
                      const unitMaterials = allMaterials.filter(
                        material => String(getMaterialUnitId(material) ?? '') === unitId,
                      );
                      const unitOnlyMaterials = unitMaterials.filter(material => !getMaterialTopicId(material));
                      const topics = unit.topics ?? [];
                      const unitResourceCount = unitMaterials.length;

                      return (
                        <details
                          key={unitId}
                          className="overflow-hidden rounded-xl border border-border bg-card dark:bg-card"
                        >
                          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 marker:hidden hover:bg-muted/50 dark:hover:bg-secondary/50 sm:px-5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                              {String(unitIndex + 1).padStart(2, '0')}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-foreground dark:text-foreground">
                                {unit.title || unit.name || `Unit ${unitIndex + 1}`}
                              </span>
                              <span className="mt-1 block text-xs text-muted-foreground dark:text-muted-foreground">
                                {topics.length} {topics.length === 1 ? 'topic' : 'topics'}
                                {unitResourceCount > 0 && ` · ${unitResourceCount} ${unitResourceCount === 1 ? 'resource' : 'resources'}`}
                              </span>
                            </span>
                            <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </summary>
                          <div className="space-y-3 border-t border-border p-3 sm:p-5 dark:border-border">
                            {unit.description && (
                              <p className="text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground">
                                {unit.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-medium text-muted-foreground dark:text-muted-foreground">
                                {unit.estimatedMinutes ? `${unit.estimatedMinutes} min` : ''}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/courses/${selectedCourse.id}/units/${encodeURIComponent(unitId)}`)}
                                className="rounded-lg"
                              >
                                Open unit
                              </Button>
                            </div>
                            {unitOnlyMaterials.length > 0 && (
                              <details className="group/unit-resources rounded-lg border border-border dark:border-border">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground marker:hidden dark:text-muted-foreground">
                                  Unit resources ({unitOnlyMaterials.length})
                                  <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open/unit-resources:rotate-180" />
                                </summary>
                                {renderMaterialItems(unitOnlyMaterials)}
                              </details>
                            )}
                            {topics.length > 0 && (
                              <ol className="space-y-2" aria-label={`${unit.title || unit.name} topics`}>
                                {topics.map((topic, topicIndex) => {
                                  const topicId = String(topic.id);
                                  const topicMaterials = unitMaterials.filter(
                                    material => String(getMaterialTopicId(material) ?? '') === topicId,
                                  );
                                  const topicTitle = topic.title || topic.name || `Topic ${topicIndex + 1}`;

                                  return (
                                    <li key={topicId}>
                                      <div className="rounded-lg border border-border px-3 py-3 dark:border-border">
                                        <div className="flex items-center gap-3">
                                          {topic.isCompleted ? (
                                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                          ) : (
                                            <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
                                          )}
                                          <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-foreground dark:text-foreground">
                                              {topicIndex + 1}. {topicTitle}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground">
                                              {topic.estimatedMinutes ? `${topic.estimatedMinutes} min` : 'Topic'}
                                              {topicMaterials.length > 0 && ` · ${topicMaterials.length} ${topicMaterials.length === 1 ? 'resource' : 'resources'}`}
                                            </p>
                                          </div>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => router.push(`/courses/${selectedCourse.id}/units/${encodeURIComponent(unitId)}?topicId=${encodeURIComponent(topicId)}`)}
                                            className="shrink-0 rounded-lg px-2"
                                          >
                                            Study
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openTopicScheduler(
                                              topicTitle,
                                              unit.title || unit.name || `Unit ${unitIndex + 1}`,
                                            )}
                                            className="shrink-0 rounded-lg px-2"
                                          >
                                            <CalendarClock className="mr-1 h-3.5 w-3.5" />
                                            Schedule
                                          </Button>
                                        </div>
                                        {topicMaterials.length > 0 && (
                                          <details className="mt-2 border-t border-border pt-2 dark:border-border">
                                            <summary className="cursor-pointer text-xs font-medium text-blue-700 dark:text-blue-300">
                                              View resources ({topicMaterials.length})
                                            </summary>
                                            {renderMaterialItems(topicMaterials)}
                                          </details>
                                        )}
                                      </div>
                                    </li>
                                  );
                                })}
                              </ol>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}

                {allMaterials.length === 0 && !isLoading && !isMaterialsError && (
                  <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground dark:bg-card dark:text-muted-foreground">
                    {debouncedSearch || materialTypeFilter !== 'all'
                      ? 'No resources match these filters. Clear the search or choose another type to see course resources.'
                      : 'There are no resources linked to this course yet.'}
                  </p>
                )}
                {isMaterialsError && (
                  <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                    Could not load course resources: {materialsError instanceof Error ? materialsError.message : 'Please try again later.'}
                  </div>
                )}
                {hasNextPage && (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="rounded-lg"
                    >
                      {isFetchingNextPage ? 'Loading resources…' : 'Load more resources'}
                    </Button>
                  </div>
                )}
              </section>
              <Dialog
                open={Boolean(topicToSchedule)}
                onOpenChange={open => {
                  if (!open && !isScheduling) setTopicToSchedule(null);
                }}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule topic study</DialogTitle>
                    <DialogDescription>
                      Add a 45-minute study session for {topicToSchedule?.title} to your schedule.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={scheduleTopicStudy} className="space-y-4">
                    <label htmlFor="roadmap-study-start" className="block text-sm font-medium text-foreground dark:text-foreground">
                      Start date and time
                    </label>
                    <input
                      id="roadmap-study-start"
                      type="datetime-local"
                      required
                      min={localDateTimeValue(new Date())}
                      value={scheduledStart}
                      onChange={event => setScheduledStart(event.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-border"
                    />
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setTopicToSchedule(null)} disabled={isScheduling}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isScheduling} className="bg-blue-600 text-white hover:bg-blue-700">
                        {isScheduling ? 'Scheduling…' : 'Add to schedule'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          ) : null}
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
                  <section
                    key={course.id}
                    className="group/course overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border dark:bg-card"
                  >
                    <div className="flex items-center gap-3 px-3 py-3.5 transition-colors hover:bg-background dark:hover:bg-card/60 sm:gap-4 sm:px-5">
                      <button
                        type="button"
                        onClick={() => router.push(
                          `/study-planner/materials?courseId=${encodeURIComponent(course.id)}&scope=${filterContext === 'owned' ? 'owned' : 'enrolled'}`,
                        )}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                        aria-label={`Open ${course.title} roadmap`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                          <BookOpen className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-foreground dark:text-foreground">{course.title}</h3>
                          <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                            {course.units.length} {course.units.length === 1 ? 'unit' : 'units'} · {course.resourceCount} {course.resourceCount === 1 ? 'resource' : 'resources'}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSectionOpen(
                          `course:${course.id}`,
                          !isSectionOpen(`course:${course.id}`, false),
                        )}
                        aria-expanded={isSectionOpen(`course:${course.id}`, false)}
                        aria-label={`${isSectionOpen(`course:${course.id}`, false) ? 'Collapse' : 'Expand'} ${course.title} resources`}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-card"
                      >
                        <ChevronDown
                          aria-hidden="true"
                          className={`h-4 w-4 transition-transform ${isSectionOpen(`course:${course.id}`, false) ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </div>
                    {isSectionOpen(`course:${course.id}`, false) && (
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
                    )}
                  </section>
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
