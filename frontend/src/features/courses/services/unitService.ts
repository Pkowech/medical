import { apiService } from '@/features/auth/services/apiClient';
import type { CourseUnit } from '@/shared/types/courseInterface';

export type Unit = CourseUnit;

class UnitService {
  private readonly baseUrl = '/units';

  /**
   * Get all units
   */
  async getUnits(): Promise<Unit[]> {
    const response = await apiService.get<Unit[] | { items: Unit[] }>(this.baseUrl);
    const data = response.data;
    return Array.isArray(data) ? data : data?.items || [];
  }

  /**
   * Get unit by ID
   */
  async getUnitById(id: string): Promise<Unit> {
    const response = await apiService.get<Unit>(`${this.baseUrl}/${id}`);
    return response.data;
  }

  /**
   * Get units for a course
   */
  async getUnitsByCourseId(courseId: string): Promise<Unit[]> {
    const response = await apiService.get<Unit[] | { items: Unit[] }>(this.baseUrl, {
      params: { courseId },
    });
    const data = response.data;
    return Array.isArray(data) ? data : data?.items || [];
  }

  /**
   * Create a new unit
   */
  async createUnit(courseId: string, unitData: Partial<Unit>): Promise<Unit> {
    const response = await apiService.post<Unit>(this.baseUrl, {
      courseId,
      ...unitData,
    });
    return response.data;
  }

  /**
   * Update a unit
   */
  async updateUnit(id: string, unitData: Partial<Unit>): Promise<Unit> {
    const response = await apiService.put<Unit>(`${this.baseUrl}/${id}`, unitData);
    return response.data;
  }

  /**
   * Delete a unit
   */
  async deleteUnit(id: string): Promise<void> {
    await apiService.delete<void>(`${this.baseUrl}/${id}`);
  }
}

export const unitService = new UnitService();
