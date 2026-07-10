import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/features/auth/services/apiClient';
import type { Course, CourseModule, Module } from '@/shared/types/courseInterface';

export const useCourseModules = (courseId: string) => {
  const queryClient = useQueryClient();

  // Reuse cached course data (if any) to avoid fetching course metadata twice
  const cachedCourse = queryClient.getQueryData<Course>(['course', courseId]);

  const {
    data: modules = [],
    isLoading,
    error,
  } = useQuery<CourseModule[]>({
    queryKey: ['courseModules', courseId],
    queryFn: async () => {
      const res = await apiService.get<CourseModule[]>(`/courses/${courseId}/modules`);
      return res.data;
    },
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
  });

  const courseTitle = cachedCourse?.title || cachedCourse?.name || '';

  const errorMsg = error ? ((error as unknown as { message?: string })?.message ?? String(error)) : null;
  return { modules: modules as Module[], courseTitle, isLoading, error: errorMsg };
};
