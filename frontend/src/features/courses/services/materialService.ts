import { apiService } from '@/features/auth/services/apiClient';
import { Material } from '@/shared/types/materialInterface';

export interface DriveFolderPreview {
  folderId: string;
  folderName: string;
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    webViewLink?: string;
    folderPath: string;
    supported: boolean;
  }>;
}

export interface DriveFolderImportResult {
  linked: number;
  alreadyLinked: number;
  failed: number;
  results: Array<{
    fileId: string;
    title: string;
    status: 'linked' | 'already-linked' | 'failed';
    materialId?: string;
    error?: string;
  }>;
}

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
    scope?: 'all' | 'enrolled' | 'recommended' | 'owned' | 'shared';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    unitId?: string;
  }): Promise<{ items: Material[]; total: number; page: number; pageSize: number }> {
    const response = await apiService.get<{ items: Material[]; total: number; page: number; pageSize: number }>('/materials/paginated', {
      params,
    });
    return response.data;
  },

  async getRecommendedMaterials() {
    const response = await apiService.get<unknown>('/materials/recommended');
    let payload = response.data;
    for (let depth = 0; depth < 3; depth += 1) {
      if (Array.isArray(payload)) return payload as Array<{
        id: string;
        title: string;
        description: string;
        type: string;
        link: string;
        priority: 'High' | 'Medium' | 'Low';
        rationale: string;
        relatedTopics: string[];
        estimatedTime: string;
      }>;
      if (payload && typeof payload === 'object' && 'data' in payload) {
        payload = (payload as { data: unknown }).data;
        continue;
      }
      break;
    }
    throw new Error('Unexpected material recommendation response.');
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

  async getMaterialPreviewContent(id: string): Promise<Uint8Array> {
    const content = await apiService.get<ArrayBuffer>(`/materials/${id}/preview`, {
      responseType: 'arraybuffer',
    });
    if (content.byteLength === 0) {
      throw new Error(`Material preview ${id} is empty`);
    }
    return new Uint8Array(content);
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

  async registerGoogleDriveMaterial(input: {
    url: string;
    title: string;
    description?: string;
    courseId: string;
    unitId: string;
    topicId?: string;
    shareWithCourse?: boolean;
  }): Promise<Material> {
    const response = await apiService.post<Material>('/materials/drive', input);
    return response.data;
  },

  async previewGoogleDriveFolder(folderUrl: string): Promise<DriveFolderPreview> {
    const response = await apiService.post<DriveFolderPreview>('/materials/drive/folder-preview', {
      folderUrl,
    });
    return response.data;
  },

  async linkGoogleDriveFolder(input: {
    items: Array<{
      fileId: string;
      title: string;
      description?: string;
      courseId: string;
      unitId: string;
      topicId?: string;
      shareWithCourse?: boolean;
    }>;
  }): Promise<DriveFolderImportResult> {
    const response = await apiService.post<DriveFolderImportResult>(
      '/materials/drive/folder-link',
      input,
    );
    return response.data;
  },


  async deleteMaterial(id: string): Promise<void> {
    await apiService.delete(`/materials/${id}`);
  },

  async shareMaterial(id: string, userIds: string[]): Promise<void> {
    await Promise.all(
      userIds
        .filter(userId => userId.trim().length > 0)
        .map(userId => apiService.post(`/materials/${id}/share`, { userId })),
    );
  },

  async setCourseSharing(id: string, shared: boolean): Promise<Material> {
    const response = await apiService.patch<Material>(`/materials/${id}/share-with-course`, { shared });
    return response.data;
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

  async attachMaterial(dto: {
    sourceMaterialId: string;
    title: string;
    topicId?: string;
    unitId?: string;
    courseId?: string;
    description?: string;
    type?: string;
  }): Promise<Material> {
    const response = await apiService.post<Material>('/materials/attach', dto);
    return response.data;
  },
};

export { materialService };
export default materialService;
