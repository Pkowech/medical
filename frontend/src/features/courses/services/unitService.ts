import { apiService } from '@/features/auth/services/apiClient';
import type { CourseUnit } from '@/shared/types/courseInterface';

export type Unit = CourseUnit;

class UnitService {
  private readonly baseUrl = '/units';

  private toApiPayload(
    unitData: Partial<Unit> & { estimatedDuration?: number; isPublished?: boolean },
    includeName = false,
  ) {
    const title = unitData.title?.trim() || unitData.name?.trim();
    const requestedOrder = unitData.order ?? unitData.orderIndex;

    if (includeName && !title) {
      throw new Error('A unit title is required.');
    }

    return {
      ...(includeName ? { name: title } : {}),
      title,
      description: unitData.description,
      content: unitData.content,
      order: requestedOrder === undefined ? undefined : Math.trunc(Number(requestedOrder)),
      estimatedDuration:
        unitData.estimatedDuration ??
        (unitData.estimatedHours === undefined
          ? undefined
          : Math.round(Number(unitData.estimatedHours) * 60)),
      estimatedMinutes: unitData.estimatedMinutes,
      isPublished:
        unitData.status === undefined
          ? unitData.isPublished
          : unitData.status === 'active',
    };
  }

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
      ...this.toApiPayload(unitData, true),
    });
    return response.data;
  }

  /**
   * Update a unit
   */
  async updateUnit(id: string, unitData: Partial<Unit>): Promise<Unit> {
    const response = await apiService.put<Unit>(
      `${this.baseUrl}/${id}`,
      this.toApiPayload(unitData),
    );
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
