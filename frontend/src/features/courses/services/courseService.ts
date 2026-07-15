import { apiService } from '@/features/auth/services/apiClient';
import { PaginatedResult } from '@/shared/types/base-responseInterface';
import { Course, CourseEnrollment } from '@/shared/types/courseInterface';
import { DetailedCourseProgress } from '@/shared/types/progressInterface';

interface CourseStats {
  totalEnrolled: number;
  completed: number;
  inProgress: number;
  avgScore?: number;
  hoursSpent?: number;
  streak?: number;
}

interface CourseFilter {
  page?: number;
  limit?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  status?: 'draft' | 'published' | 'archived' | 'under_review';
  categoryId?: string;
  search?: string;
}

export interface UnitActivationResult {
  success: boolean;
  slotNumber?: number;
  message?: string;
}

/**
 * Standardizes API responses by handling both unwrapped and wrapped { data: T } structures.
 */
const parseResponse = <T>(response: unknown): T => {
  if (!response || typeof response !== 'object') return response as T;
  
  const resp = response as Record<string, any>;
  
  // Handle backend response format: { data: [], pagination: {} }
  if (Array.isArray(resp.data) && resp.pagination) {
    return {
      items: resp.data,
      total: resp.pagination.total,
      page: resp.pagination.page,
      pageSize: resp.pagination.limit,
      totalPages: resp.pagination.totalPages,
      hasMore: resp.pagination.hasNext
    } as unknown as T;
  }

  // If response has a data property AND that property isn't the actual data (e.g. for PaginatedResult which has its own items data)
  if (resp.data !== undefined) {
     const data = resp.data;
     // If it's a PaginatedResult, we want the whole object because it contains items, total, etc.
     if (resp.items !== undefined || data?.items !== undefined) {
        return (data?.items !== undefined ? data : resp) as T;
     }
     return data as T;
  }
  return resp as T;
};

class CourseService {
  private readonly baseUrl = '/courses';

  /**
   * Fetches a paginated list of courses with optional filters.
   */
  async getCourses(
    filters: CourseFilter = { page: 1, limit: 12 }
  ): Promise<PaginatedResult<Course>> {
    const cleanedFilters: Record<string, string | number> = {
      page: filters.page || 1,
      limit: filters.limit || 12,
    };

    if (filters.difficulty?.trim()) cleanedFilters.difficulty = filters.difficulty;
    if (filters.categoryId?.trim()) cleanedFilters.categoryId = filters.categoryId;
    if (filters.status?.trim()) cleanedFilters.status = filters.status;
    if (filters.search?.trim()) cleanedFilters.search = filters.search;

    const response = await apiService.get<unknown>(this.baseUrl, {
      params: cleanedFilters,
    });
    return parseResponse<PaginatedResult<Course>>(response.data);
  }

  /**
   * Fetches a single course by its ID.
   */
  async getCourseById(courseId: string): Promise<Course> {
    const response = await apiService.get<unknown>(`${this.baseUrl}/${courseId}`, {
      params: {
        include: 'units,topics,materials',
      },
    });
    return parseResponse<Course>(response.data);
  }

  /**
   * Creates a new course.
   */
  async createCourse(courseData: Partial<Course>): Promise<Course> {
    const response = await apiService.post<unknown>(this.baseUrl, courseData);
    return parseResponse<Course>(response.data);
  }

  /**
   * Updates an existing course.
   */
  async updateCourse(courseId: string, courseData: Partial<Course>): Promise<Course> {
    const response = await apiService.patch<unknown>(`${this.baseUrl}/${courseId}`, courseData);
    return parseResponse<Course>(response.data);
  }

  /**
   * Deletes a course.
   */
  async deleteCourse(courseId: string): Promise<void> {
    await apiService.delete<void>(`${this.baseUrl}/${courseId}`);
  }

  /**
   * Fetches courses the current user is enrolled in.
   */
  async getEnrolledCourses(
    filters: { status?: string; page?: number; limit?: number } = { page: 1, limit: 20 }
  ): Promise<PaginatedResult<CourseEnrollment>> {
    const cleanedFilters: Record<string, string | number | undefined> = {
      page: filters.page,
      limit: filters.limit,
    };

    if (filters.status) cleanedFilters.status = filters.status;

    const response = await apiService.get<unknown>(`${this.baseUrl}/my-courses`, {
      params: cleanedFilters,
    });
    return parseResponse<PaginatedResult<CourseEnrollment>>(response.data);
  }

  /**
   * Fetches units the current user is enrolled in (derived from active course enrollments and progress).
   */
  async getEnrolledUnits(): Promise<Array<Record<string, unknown>>> {
    try {
      const { useAuthStore } = await import('@/features/auth/store/useAuthStore');
      const user = useAuthStore.getState().user;
      const userId = user?.id;
      
      if (!userId) {
        console.warn('No user ID available, cannot fetch enrolled units');
        return [];
      }
      
      const response = await apiService.get<unknown>(`/progress/dashboard/${userId}`);
      const data = parseResponse<Record<string, unknown>>(response.data);
      if (data && typeof data === 'object' && Array.isArray(data.enrolledUnits)) {
        return data.enrolledUnits as Array<Record<string, unknown>>;
      }
      return [];
    } catch (error: unknown) {
      console.error('Error fetching enrolled units:', error);
      return [];
    }
  }

  /**
   * Fetches user course statistics.
   */
  async getCourseStats(): Promise<CourseStats> {
    const response = await apiService.get<unknown>(`${this.baseUrl}/overview`);
    return parseResponse<CourseStats>(response.data);
  }

  /**
   * Enrolls the current user in a course.
   */
  async enrollInCourse(courseId: string): Promise<CourseEnrollment> {
    const response = await apiService.post<unknown>(`${this.baseUrl}/${courseId}/enroll`);
    return parseResponse<CourseEnrollment>(response.data);
  }

  /**
   * Unenrolls the current user from a course.
   */
  async unenrollFromCourse(courseId: string): Promise<void> {
    await apiService.delete<void>(`${this.baseUrl}/${courseId}/enroll`);
  }

  /**
   * Searches for courses by keyword.
   */
  async searchCourses(query: string, limit = 12): Promise<Course[]> {
    const res = await this.getCourses({ search: query, limit });
    return res.items || [];
  }

  /**
   * Gets featured courses.
   */
  async getFeaturedCourses(limit = 6): Promise<Course[]> {
    const response = await apiService.get<unknown>(`${this.baseUrl}/featured`, {
      params: { limit },
    });
    const parsed = parseResponse<PaginatedResult<Course> | Course[]>(response.data);
    return Array.isArray(parsed) ? parsed : (parsed as PaginatedResult<Course>).items || [];
  }

  /**
   * Gets recommended courses for the user.
   */
  async getRecommendedCourses(limit = 10): Promise<Course[]> {
    const response = await apiService.get<unknown>(`${this.baseUrl}/recommended`, {
      params: { limit },
    });
    const parsed = parseResponse<PaginatedResult<Course> | Course[]>(response.data);
    return Array.isArray(parsed) ? parsed : (parsed as PaginatedResult<Course>).items || [];
  }

  /**
   * Fetches only published courses (convenience wrapper around `getCourses`).
   */
  async getPublishedCourses(
    filters: { page?: number; limit?: number } = { page: 1, limit: 12 }
  ): Promise<PaginatedResult<Course>> {
    return this.getCourses({ page: filters.page, limit: filters.limit, status: 'published' });
  }

  /**
   * Marks a unit as completed.
   */
  async completeUnit(courseId: string, unitId: string): Promise<void> {
    await apiService.post<void>(`${this.baseUrl}/${courseId}/units/${unitId}/complete`);
  }

  /**
   * Gets course progress.
   */
  async getCourseProgress(courseId: string): Promise<CourseEnrollment> {
    const response = await apiService.get<unknown>(`${this.baseUrl}/${courseId}/progress`);
    return parseResponse<CourseEnrollment>(response.data);
  }

  /**
   * Gets detailed course progress including topics and units.
   */
  async getDetailedCourseProgress(courseId: string): Promise<DetailedCourseProgress> {
    const response = await apiService.get<unknown>(`/progress/courses/${courseId}/detailed`);
    return parseResponse<DetailedCourseProgress>(response.data);
  }

  /**
   * Activates a unit (enrolls student in a study slot).
   */
  async activateUnit(unitId: string, maxConcurrent = 4): Promise<UnitActivationResult> {
    const response = await apiService.post<unknown>(`/unit-progress/activate`, {
      unitId,
      maxConcurrent,
    });
    return parseResponse<UnitActivationResult>(response.data);
  }
}

export const courseService = new CourseService();
