import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { learningPathService } from '../services/learningPathService';
import { apiService } from '@/features/auth/services/apiClient';
import { unwrapApiPayload, toDisplayString } from '@/shared/utils/apiHelpers';
import {
  LearningPath,
  PathPhase,
  PathModule,
  Milestone,
} from '@/shared/types/learningInterface';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/store/useAuthStore';

export function useLearningPath(pathId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore(state => state.user?.id);

  const pathQuery = useQuery({
    queryKey: ['learning-path', pathId],
    queryFn: async (): Promise<LearningPath> => {
      const response = await apiService.get<unknown>(`/learning-paths/${pathId}`);
      const rawObj = unwrapApiPayload<Record<string, unknown>>(response);
      const analyticsObj = (rawObj.analytics as Record<string, unknown> | undefined) ?? {};
      const createdByObj =
        (rawObj.createdBy as Record<string, unknown> | undefined) ??
        (rawObj.created_by as Record<string, unknown> | undefined) ??
        {};
      const pathStructureObj =
        (rawObj.pathStructure as Record<string, unknown> | undefined) ??
        (rawObj.path_structure as Record<string, unknown> | undefined) ??
        {};
      const phasesRaw = Array.isArray(rawObj.phases)
        ? (rawObj.phases as unknown[])
        : Array.isArray(pathStructureObj.phases)
        ? (pathStructureObj.phases as unknown[])
        : [];

      const mappedPhases: PathPhase[] = phasesRaw.map((p) => {
        const phase = p as Record<string, unknown>;
        const modules = Array.isArray(phase.modules) ? (phase.modules as unknown[]) : [];
        return {
          id: toDisplayString(phase.id),
          title: toDisplayString(phase.title),
          description: toDisplayString(phase.description),
          order: Number(phase.order ?? 0),
          estimatedWeeks: Number(phase.estimatedWeeks ?? phase.estimated_weeks ?? 0),
          modules: modules.map((m) => {
            const moduleItem = m as Record<string, unknown>;
            return {
              id: toDisplayString(moduleItem.id),
              title: toDisplayString(moduleItem.title),
              description: toDisplayString(moduleItem.description),
              type: toDisplayString(moduleItem.type, 'course'),
              resourceId: toDisplayString(moduleItem.resourceId ?? moduleItem.resource_id),
              estimatedHours: Number(moduleItem.estimatedHours ?? moduleItem.estimated_hours ?? 0),
              isRequired: Boolean(moduleItem.isRequired ?? moduleItem.is_required ?? false),
              unlockConditions: Array.isArray(moduleItem.unlockConditions)
                ? moduleItem.unlockConditions.map(String)
                : Array.isArray(moduleItem.unlock_conditions)
                ? moduleItem.unlock_conditions.map(String)
                : [],
              order: Number(moduleItem.order ?? 0),
            } as PathModule;
          }),
        } as PathPhase;
      });

      return {
        id: toDisplayString(rawObj.id ?? rawObj.path_id),
        title: toDisplayString(rawObj.title),
        description: toDisplayString(rawObj.description),
        category: toDisplayString(rawObj.category),
        difficulty: toDisplayString(rawObj.difficulty),
        status: toDisplayString(rawObj.status),
        specialization: rawObj.specialization ? toDisplayString(rawObj.specialization) : undefined,
        pathType: (rawObj.pathType ?? rawObj.path_type)
          ? toDisplayString(rawObj.pathType ?? rawObj.path_type)
          : undefined,
        estimatedDurationWeeks: Number(
          rawObj.estimatedDurationWeeks ?? rawObj.estimated_duration_weeks ?? 0,
        ),
        estimatedHoursPerWeek: Number(
          rawObj.estimatedHoursPerWeek ?? rawObj.estimated_hours_per_week ?? 0,
        ),
        tags: Array.isArray(rawObj.tags) ? (rawObj.tags as string[]) : [],
        learningObjectives: Array.isArray(rawObj.learningObjectives)
          ? (rawObj.learningObjectives as string[])
          : Array.isArray(rawObj.learning_objectives)
          ? (rawObj.learning_objectives as string[])
          : [],
        analytics: {
          totalEnrollments: Number(
            analyticsObj.totalEnrollments ?? analyticsObj.total_enrollments ?? 0,
          ),
          completionRate: Number(
            analyticsObj.completionRate ?? analyticsObj.completion_rate ?? 0,
          ),
          userRatings: {
            average: Number(
              (analyticsObj.userRatings as Record<string, unknown> | undefined)?.average ??
                (analyticsObj.user_ratings as Record<string, unknown> | undefined)?.average ??
                0,
            ),
            count: Number(
              (analyticsObj.userRatings as Record<string, unknown> | undefined)?.count ??
                (analyticsObj.user_ratings as Record<string, unknown> | undefined)?.count ??
                0,
            ),
          },
        },
        createdBy: {
          id: toDisplayString(createdByObj.id ?? createdByObj.user_id ?? createdByObj.userId),
          firstName: toDisplayString(createdByObj.firstName ?? createdByObj.first_name),
          lastName: toDisplayString(createdByObj.lastName ?? createdByObj.last_name),
        },
        courses: Array.isArray(rawObj.courses) ? (rawObj.courses as LearningPath['courses']) : [],
        milestones: Array.isArray(rawObj.milestones)
          ? (rawObj.milestones as unknown[]).map((m) => {
              const milestone = m as Record<string, unknown>;
              const rewards = milestone.rewards as Record<string, unknown> | undefined;
              return {
                id: toDisplayString(milestone.id),
                title: toDisplayString(milestone.title),
                description: toDisplayString(milestone.description ?? milestone.desc),
                type: toDisplayString(milestone.type),
                order: Number(milestone.order ?? 0),
                isRequired: Boolean(milestone.isRequired ?? milestone.is_required ?? false),
                rewards: rewards
                  ? {
                      points: Number(rewards.points ?? 0),
                      badgeId: toDisplayString(rewards.badgeId ?? rewards.badge_id),
                      certificate: rewards.certificate as Record<string, unknown> | undefined,
                    }
                  : undefined,
              } as Milestone;
            })
          : [],
        phases: mappedPhases,
        pathStructure: { phases: mappedPhases },
      };
    },
    enabled: Boolean(pathId),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    meta: { persist: Boolean(userId) },
  });

  const progressQuery = useQuery({
    queryKey: ['learning-path-progress', pathId, userId],
    queryFn: async () => {
      const response = await apiService.get<unknown>(`/learning-paths/${pathId}/progress`);
      return unwrapApiPayload<Record<string, unknown>>(response);
    },
    enabled: Boolean(pathId),
    staleTime: 3 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    meta: { persist: Boolean(userId) },
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      await learningPathService.enroll(pathId);
    },
    onSuccess: () => {
      toast.success('Successfully enrolled in curriculum!');
      void queryClient.invalidateQueries({ queryKey: ['learning-path', pathId] });
      void queryClient.invalidateQueries({ queryKey: ['learning-path-progress', pathId] });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Failed to enroll in curriculum';
      toast.error(msg);
    },
  });

  return {
    learningPath: pathQuery.data ?? null,
    progressData: progressQuery.data ?? null,
    isLoading: pathQuery.isLoading || progressQuery.isLoading,
    isError: pathQuery.isError,
    error: pathQuery.error,
    enroll: enrollMutation.mutateAsync,
    isEnrolling: enrollMutation.isPending,
    refetch: () => {
      void pathQuery.refetch();
      void progressQuery.refetch();
    },
  };
}
