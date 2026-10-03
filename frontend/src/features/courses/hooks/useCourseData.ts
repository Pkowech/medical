import { useQuery } from '@tanstack/react-query';
import { courseService } from '@/features/courses/services/courseService';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import type { Course, CourseUnit, CourseData } from '@/shared/types/courseInterface';
import type { Material as CourseMaterial } from '@/shared/types/materialInterface';
import type { DetailedCourseProgress, TopicProgress, UnitProgress } from '@/shared/types/progressInterface';

// Local normalized lesson shape used internally by this hook
type NormalizedLesson = {
  id: string;
  title: string;
  type: 'text' | 'video' | 'interactive';
  duration: string;
  content: { text: string; video?: string };
  isCompleted?: boolean;
  masteryUnlocked?: boolean;
  nextTopicUnlocked?: boolean;
  failedAttempts?: number;
};

export const useCourseData = (courseId: string) => {
  const userId = useAuthStore(state => state.user?.id);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['course', courseId, userId],
    queryFn: async (): Promise<CourseData | null> => {
      if (!courseId) return null;
      
      let course: Course & {
        materials?: CourseMaterial[];
        discussions?: Record<string, unknown>[];
      } | null = null;
      
      try {
        course = await courseService.getCourseById(courseId);
      } catch (err: unknown) {
        console.error('Failed to fetch course:', err);
        let status: number | undefined;
        let message = 'Unknown error';

        if (typeof err === 'object' && err !== null) {
          const e = err as Record<string, unknown>;
          if (typeof e.status === 'number') status = e.status;
          if (typeof e.message === 'string') message = e.message;

          if (typeof e.rawResponse === 'object' && e.rawResponse !== null) {
            const raw = e.rawResponse as Record<string, unknown>;
            if (typeof raw.message === 'string') message = raw.message;
            if (typeof raw.statusCode === 'number') status = raw.statusCode;
          }
        }

        if (status === 404) {
          throw new Error(`Course not found (ID: ${courseId}). It may have been removed or the ID is invalid.`);
        } else if (status === 403) {
          throw new Error('Access denied. You may not have permission to view this course.');
        } else {
          throw new Error(`Failed to load course: ${message}`);
        }
      }

      if (!course) return null;

      // Fetch progress but don't let it fail the whole query
      let progressData: DetailedCourseProgress | null = null;
      try {
        progressData = await courseService.getDetailedCourseProgress(courseId);
      } catch (err) {
        console.warn('Failed to fetch course progress (non-critical):', err);
        // Continue without progress data
      }

      const topicProgressMap: Record<string, TopicProgress> = {};
      const unitProgressMap: Record<string, UnitProgress & { completed?: boolean }> = {};

      if (progressData) {
        if (Array.isArray(progressData.topicProgress)) {
          progressData.topicProgress.forEach((p) => {
            if (p.topicId) topicProgressMap[String(p.topicId)] = p;
          });
        }
        if (Array.isArray(progressData.unitProgress)) {
          progressData.unitProgress.forEach((p) => {
            if (p.id) unitProgressMap[p.id] = p;
          });
        }
      }

      // Normalize backend Course -> shape expected by EducationalCourseLayout
      const chapters = (course.units || []) as CourseUnit[];
      const normalizedChapters = chapters.map(u => {
        const anyUnit = u as unknown as Record<string, unknown>;
        let lessonArray: NormalizedLesson[] = [];
        const topics = Array.isArray(anyUnit.topics)
          ? (anyUnit.topics as Array<Record<string, unknown>>)
          : [];
        
        // Use topic progress if it matches u.id (since topics map to lessons in this view)
        const unitProgress = unitProgressMap[u.id];

        if (topics.length > 0) {
          lessonArray = topics.map(topic => {
            const topicId = String(topic.id ?? topic.name ?? '');
            const topicProgress = topicProgressMap[topicId];
            const title = String(topic.title || topic.name || topicId);
            const description =
              typeof topic.description === 'string' ? topic.description : '';

            return {
              id: topicId,
              title,
              type: 'text',
              duration:
                typeof topic.estimatedMinutes === 'number'
                  ? `${topic.estimatedMinutes}m`
                  : '',
              content: { text: description },
              isCompleted: Boolean(topicProgress?.isCompleted || topicProgress?.status === 'completed' || topic.isCompleted),
              masteryUnlocked: Boolean(topicProgress?.masteryUnlocked || topicProgress?.status === 'completed' || topic.masteryUnlocked),
              nextTopicUnlocked: topicProgress?.nextTopicUnlocked ||
                (typeof topicProgress?.quizScores?.['nextTopicUnlocked'] === 'boolean'
                  ? topicProgress.quizScores['nextTopicUnlocked'] as boolean
                  : topicProgress?.masteryUnlocked ?? topicProgress?.isCompleted ?? false),
              failedAttempts: topicProgress?.failedAttempts ?? 0,
            };
          });
        } else if (
          Array.isArray(anyUnit.lessons) &&
          (anyUnit.lessons as Array<Record<string, unknown>>).length > 0
        ) {
          const rawLessons = anyUnit.lessons as Array<Record<string, unknown>>;
          lessonArray = rawLessons.map(l => {
            const id = (l.id ?? l.name) as string | number;
            const topicId = String(id);
            const topicProgress = topicProgressMap[topicId];

            const title = String(
              l.title && typeof l.title === 'string'
                ? l.title
                : l.name && typeof l.name === 'string'
                  ? l.name
                  : (id ?? '')
            );
            const type = (l.type as NormalizedLesson['type']) || 'text';
            const duration =
              l.duration && typeof l.duration === 'number'
                ? `${l.duration}m`
                : l.length && typeof l.length === 'number'
                  ? `${l.length}m`
                  : '';
            let contentText = '';
            let videoUrl = '';
            
            if (typeof l.content === 'string') {
              contentText = l.content as string;
            } else if (l.content && typeof l.content === 'object') {
              const contentObj = l.content as Record<string, unknown>;
              contentText = (contentObj.text as string) || (l.description as string) || '';
              videoUrl = (contentObj.video as string) || '';
            } else if (typeof l.description === 'string') {
              contentText = l.description as string;
            }

            return {
              id: id,
              title,
              type,
              duration,
              content: { text: contentText, video: videoUrl },
              isCompleted: topicProgress?.isCompleted ?? false,
              masteryUnlocked: topicProgress?.masteryUnlocked ?? false,
              nextTopicUnlocked: topicProgress?.nextTopicUnlocked ||
                (typeof topicProgress?.quizScores?.['nextTopicUnlocked'] === 'boolean'
                  ? topicProgress.quizScores['nextTopicUnlocked'] as boolean
                  : topicProgress?.masteryUnlocked ?? topicProgress?.isCompleted ?? false),
              failedAttempts: topicProgress?.failedAttempts ?? 0,
            } as NormalizedLesson;
          });
        }

        return {
          id: u.id,
          title: u.title || String(u.id),
          duration: u.duration ? `${u.duration}m` : '',
          lessons: lessonArray,
          isCompleted: unitProgress?.completed ?? false,
          progressPercentage: unitProgress?.progressPercentage ?? 0,
        };
      });

      // Collect all materials from units and topics as well
      const extraMaterials: CourseMaterial[] = [];
      course.units?.forEach(u => {
        const unitObj = u as unknown as Record<string, unknown>;

        // Add materials linked to the unit
        if (Array.isArray(unitObj.materials)) {
          (unitObj.materials as unknown as Array<Record<string, unknown>>).forEach(m => {
            extraMaterials.push({
              ...(m as unknown as CourseMaterial),
              unitId: String(u.id),
            });
          });
        }

        // Add materials linked to topics within the unit
        if (Array.isArray(unitObj.topics)) {
          (unitObj.topics as unknown as Array<Record<string, unknown>>).forEach(t => {
            if (Array.isArray(t.materials)) {
              (t.materials as unknown as Array<Record<string, unknown>>).forEach(m => {
                extraMaterials.push({
                  ...(m as unknown as CourseMaterial),
                  unitId: String(u.id),
                  topicId: String(t.id),
                });
              });
            }
          });
        }
      });

      const courseResources = (course.materials ||
          (course as unknown as Record<string, unknown>).resources ||
          []) as CourseMaterial[];

      // Deduplicate and merge
      const allResources = [...courseResources];
      extraMaterials.forEach(em => {
        if (!allResources.find(r => r.id === em.id)) {
          allResources.push(em);
        }
      });

      return {
        id: course.id,
        title: course.name || course.title || '',
        description: course.description || '',
        chapters: normalizedChapters,
        units: (course.units || []) as CourseUnit[],
        resources: allResources,
        discussions: course.discussions || [],
      };
    },
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
    meta: { persist: Boolean(userId) },
  });

  return { data, isLoading, error, refetch };
};
