import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/features/auth/services/apiClient';
import type { CourseData, Topic } from '@/shared/types/courseInterface';
import type { Material } from '@/shared/types/materialInterface';

interface TopicWithMaterials extends Topic {
  materials?: Material[];
}

interface UnitResponse {
  id: string;
  name: string;
  title?: string;
  description?: string;
  content?: string;
  order: number;
  estimatedDuration?: number;
  estimatedMinutes?: number;
  learningObjectives?: string | string[] | Record<string, unknown>;
  isPublished?: boolean;
  courseId?: string;
  createdAt?: string;
  updatedAt?: string;
  topics?: TopicWithMaterials[];
  materials?: Material[];
  resources?: Material[];
  discussions?: Record<string, unknown>[];
}

/**
 * Normalizes a Unit API response into the CourseData shape used by the layout.
 *
 * KEY CHANGE (vs. old version):
 *   OLD → all topics collapsed into ONE chapter  ➜  sidebar shows unit as a single row
 *   NEW → each topic becomes its OWN chapter     ➜  sidebar lists every topic individually
 *
 * Sidebar mental model after this change:
 *   Chapter = Topic          (e.g. "Skin Layers", "Melanocytes", …)
 *   Lesson  = Topic itself   (single lesson per chapter so navigation still works)
 *
 * The unit-level and topic-level materials are both surfaced via `resources` so
 * the content area can display PDFs / videos / notes inline.
 */
const normalizeUnitToChapters = (unit: UnitResponse): CourseData => {
  const topics = (unit.topics || []) as TopicWithMaterials[];

  // ── Build one chapter per topic ─────────────────────────────────────────
  const chapters = topics.map(topic => {
    // Collect materials that belong to this topic
    const topicMaterials: Material[] = topic.materials || [];

    return {
      id: topic.id,
      title: topic.name || topic.title || 'Untitled Topic',
      duration: topic.estimatedMinutes ? `${topic.estimatedMinutes}m` : '0m',
      // Each chapter has exactly ONE lesson — the topic itself.
      // This keeps useCourseNavigation happy (it iterates chapters[n].lessons[m]).
      lessons: [
        {
          id: topic.id,
          title: topic.name || topic.title || 'Untitled Topic',
          type: 'text' as const,
          duration: topic.estimatedMinutes ? `${topic.estimatedMinutes}m` : '0m',
          content: {
            text: topic.description || '',
          },
          isCompleted: topic.isCompleted ?? false,
          // Attach topic-level materials directly on the lesson so CourseContent
          // can render them without an extra lookup.
          resources: topicMaterials,
        },
      ],
    };
  });

  // ── Aggregate all materials for the sidebar Resources section ───────────
  // Unit-level materials + all topic materials, deduped by id.
  const unitMaterials = (unit.materials || unit.resources || []) as Material[];
  const topicMaterials = topics
    .flatMap(t => t.materials || [])
    .filter((m, idx, arr) => arr.findIndex(x => x.id === m.id) === idx);

  const allMaterials = [
    ...unitMaterials,
    ...topicMaterials.filter(tm => !unitMaterials.find(um => um.id === tm.id)),
  ];

  return {
    id: unit.id,
    title: unit.title || unit.name,
    description: unit.description || '',
    chapters,          // ← now N chapters (one per topic), not 1
    resources: allMaterials,
    discussions: unit.discussions || [],
  };
};

export const useUnitData = (unitId: string) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['unit', unitId],
    queryFn: async (): Promise<CourseData | null> => {
      if (!unitId) return null;

      try {
        const response = await apiService.get<UnitResponse>(`/units/${unitId}`, {
          params: {
            include: 'topics,materials,topicMaterials',
          },
        });

        const unit = response.data as UnitResponse;

        if (!unit) {
          throw new Error(`Unit with ID ${unitId} not found`);
        }

        return normalizeUnitToChapters(unit);
      } catch (err: unknown) {
        console.error('Failed to fetch unit:', err);
        const error = err as {
          status?: number;
          rawResponse?: { statusCode?: number; message?: string };
          message?: string;
        };
        const status = error?.status || error?.rawResponse?.statusCode;
        const message = error?.message || error?.rawResponse?.message || 'Unknown error';

        if (status === 404) {
          throw new Error(
            `Unit not found (ID: ${unitId}). It may have been removed or the ID is invalid.`,
          );
        } else if (status === 403) {
          throw new Error('Access denied. You may not have permission to view this unit.');
        } else {
          throw new Error(`Failed to load unit: ${message}`);
        }
      }
    },
    enabled: !!unitId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return { data, isLoading, error: error as Error | null, refetch };
};

/**
 * Hook to fetch a specific topic within a unit (unchanged).
 */
export const useTopicData = (topicId: string) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['topic', topicId],
    queryFn: async (): Promise<TopicWithMaterials | null> => {
      if (!topicId) return null;

      try {
        const response = await apiService.get<TopicWithMaterials>(`/topics/${topicId}`, {
          params: { include: 'materials' },
        });

        const topic = response.data as TopicWithMaterials;
        if (!topic) throw new Error(`Topic with ID ${topicId} not found`);
        return topic;
      } catch (err: unknown) {
        console.error('Failed to fetch topic:', err);
        const error = err as {
          status?: number;
          rawResponse?: { statusCode?: number; message?: string };
          message?: string;
        };
        const status = error?.status || error?.rawResponse?.statusCode;
        const message = error?.message || error?.rawResponse?.message || 'Unknown error';

        if (status === 404) {
          throw new Error(
            `Topic not found (ID: ${topicId}). It may have been removed or the ID is invalid.`,
          );
        } else if (status === 403) {
          throw new Error('Access denied. You may not have permission to view this topic.');
        } else {
          throw new Error(`Failed to load topic: ${message}`);
        }
      }
    },
    enabled: !!topicId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return { data, isLoading, error: error as Error | null, refetch };
};