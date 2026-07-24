import { apiService } from '@/features/auth/services/apiClient';
import { Material } from '@/shared/types/materialInterface';

const materialService = {
  async getMaterials(filters?: { unitId?: string; type?: string }): Promise<Material[]> {
    const response = await apiService.get<Material[]>('/materials', {
      params: filters,
    });
    return response.data;
  },

  async getMaterialsPaginated(params: {
    page: number;
    limit: number;
    type?: string;
    search?: string;
    courseId?: string;
    scope?: 'all' | 'enrolled' | 'recommended';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    unitId?: string;
  }): Promise<{ items: Material[]; total: number; page: number; pageSize: number }> {
    try {
      const response = await apiService.get<{ items: Material[]; total: number; page: number; pageSize: number }>('/materials/paginated', {
        params,
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching paginated materials:', error);
      return { items: [], total: 0, page: params.page, pageSize: params.limit };
    }
  },

  async createMaterial(material: Material): Promise<Material> {
    const response = await apiService.post<Material>('/materials', material);
    return response.data;
  },

  async getMaterialById(id: string): Promise<Material> {
    const response = await apiService.get<Material>(`/materials/${id}`);
    return response.data;
  },

  async getMaterialsByTopicId(topicId: string): Promise<Material[]> {
    try {
      const response = await apiService.get<Material[] | { items: Material[] }>('/materials', {
        params: { topicId },
      });
      const data = response.data;
      return Array.isArray(data) ? data : data?.items || [];
    } catch (error) {
      console.error('Error fetching materials by topic:', error);
      return [];
    }
  },

  async getMaterialWithFileUrl(id: string): Promise<Material & { fileUrl?: string }> {
    const response = await apiService.get<Material & { fileUrl?: string }>(
      `/materials/${id}/with-url`
    );
    return response.data;
  },

  async uploadMaterial(
    formData: FormData,
    options?: { onUploadProgress?: (progressEvent: ProgressEvent | import('axios').AxiosProgressEvent) => void }
  ): Promise<Material> {
    const response = await apiService.post<Material>('/materials/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: options?.onUploadProgress as unknown as
        | ((progressEvent: ProgressEvent | import('axios').AxiosProgressEvent) => void)
        | undefined,
    });
    return response.data;
  },


  async deleteMaterial(id: string): Promise<void> {
    await apiService.delete(`/materials/${id}`);
  },

  async shareMaterial(id: string, userIds: string[]): Promise<void> {
    await apiService.post('/materials/share', { materialId: id, userIds });
  },

  // Local File System Methods (for Offline/Local Library)
  async browseLocalFiles(path?: string): Promise<Array<{ name: string; type: 'file' | 'directory'; path: string; size?: number; extension?: string }>> {
    const response = await apiService.get<Array<{ name: string; type: 'file' | 'directory'; path: string; size?: number; extension?: string }>>('/materials/local/browse', {
      params: { path },
    });
    return response.data;
  },

  async searchLocalFiles(query: string): Promise<Array<{ name: string; path: string; directory: string }>> {
    const response = await apiService.get<Array<{ name: string; path: string; directory: string }>>('/materials/local/search', {
      params: { query },
    });
    return response.data;
  },

  getLocalFileUrl(path: string): string {
    // Construct the URL directly for viewers (iframe/pdf.js)
    // Assuming API base URL is handled by the proxy or absolute path. 
    // Since apiService usually handles the base, we might need access to it.
    // For now, assuming relative to the current origin if proxied, or we can use the backend URL.
    // Ideally this should come from a config.
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    return `${baseUrl}/materials/local/file?path=${encodeURIComponent(path)}`;
  },
};

export default materialService;
