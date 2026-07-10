import { apiService } from '@/features/auth/services/apiClient';

import { User, UserProfileResponse } from '@/shared/types';
import { PaginatedResult } from '@/shared/types';
import { UserAnalytics, UserInsights } from '@/shared/types/analyticsInterface';
import { toast } from 'sonner';

const ANALYTICS_BASE_URL = '/analytics';

class UserService {
  private baseUrl = '/users';

  /**
   * Fetches a paginated list of users.
   */
  async getUsers(page = 1, limit = 10): Promise<PaginatedResult<User>> {
    const response = await apiService.get<PaginatedResult<User>>(this.baseUrl, {
      params: { page, limit },
    });
    return response.data;
  }

  /**
   * Fetches the profile of the currently authenticated user.
   */
  async getMyProfile(): Promise<UserProfileResponse> {
    const response = await apiService.get<UserProfileResponse>(`${this.baseUrl}/profile`);
    return response.data;
  }

  /**
   * Fetches a specific user by their ID.
   */
  async getUserById(userId: string): Promise<User> {
    const response = await apiService.get<User>(`${this.baseUrl}/${userId}`);
    return response.data;
  }

  /**
   * Fetches a specific user's profile by their ID.
   */
  async getUserProfile(userId: string): Promise<UserProfileResponse> {
    const response = await apiService.get<UserProfileResponse>(`${this.baseUrl}/profile/${userId}`);
    return response.data;
  }

  /**
   * Updates a user's profile information.
   */
  async updateUserProfile(userId: string, data: Partial<User>): Promise<User> {
    // Map phone to phoneNumber if present (backend expects phoneNumber)
    const updateData = { ...data };
    if ((updateData as Record<string, unknown>).phone && !updateData.phoneNumber) {
      updateData.phoneNumber = (updateData as Record<string, unknown>).phone as string;
    }
    
    const response = await apiService.patch<User>(`${this.baseUrl}/${userId}`, updateData);
    return response.data;
  }

  /**
   * Uploads a raw image file to the backend, which optimises it (400×400 WebP)
   * and stores it in Cloudflare R2. Returns the signed download URL.
   */
  async uploadProfileImage(userId: string, file: File): Promise<{ url: string; key: string }> {
    const formData = new FormData();
    formData.append('file', file);
    // Do NOT set Content-Type manually — browser/Axios sets it automatically
    // with the correct multipart boundary that Multer requires.
    const response = await apiService.post<{ url: string; key: string }>(
      `${this.baseUrl}/${userId}/profile/image`,
      formData,
    );
    return response.data;
  }

  /**
   * Updates the role of a specific user.
   */
  async updateUserRole(userId: string, role: string): Promise<void> {
    await apiService.put(`${this.baseUrl}/${userId}/role`, { role });
  }

  /**
   * Deletes a user by their ID.
   */
  async deleteUser(userId: string): Promise<void> {
    await apiService.delete(`${this.baseUrl}/${userId}`);
  }

  /**
   * Finds a user by their email address.
   */
  async findUserByEmail(email: string): Promise<User | null> {
    try {
      const response = await apiService.get<User>(`${this.baseUrl}/email/${email}`);
      return response.data;
    } catch {
      return null;
    }
  }

  async getUserAnalytics(userId: string): Promise<UserAnalytics | null> {
    try {
      const response = await apiService.get<UserAnalytics>(
        `${ANALYTICS_BASE_URL}/user/${userId}`
      );
      return response.data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Error fetching user analytics:', err.message, err.stack);
      toast.error('Failed to load user analytics.');
      return null;
    }
  }

  async getUserInsights(userId: string): Promise<UserInsights | null> {
    try {
      const response = await apiService.get<UserInsights>(
        `${ANALYTICS_BASE_URL}/insights/${userId}`
      );
      return response.data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Error fetching user insights:', err.message, err.stack);
      toast.error('Failed to load user insights.');
      return null;
    }
  }
}

export const userService = new UserService();
export default userService;
