import {
  Notification,
  NotificationResponse,
} from '@/shared/types/notificationsInterface';
import apiClient from '../auth/services/apiClient';

class NotificationService {
  // apiService already prefixes requests with the backend URL and '/v1'
  private readonly baseUrl = '/notifications';

  async getNotifications(page = 1, limit = 10): Promise<Notification[]> {
    const response = await apiClient.get<Notification[]>(
      `${this.baseUrl}?page=${page}&limit=${limit}`
    );
    // apiClient returns response.data directly; backend may return an array or an object with .data
    let notifications: Notification[] = [];
    if (Array.isArray(response)) {
      notifications = response as Notification[];
    } else {
      notifications = (response as any)?.data ?? [];
    }

    // Return notifications directly - title is already a property of Notification
    return notifications;
  }

  async markNotificationAsRead(id: string): Promise<Notification> {
    try {
      const response = await apiClient.patch<NotificationResponse>(`${this.baseUrl}/${id}/read`);
      // Support responses that either return the resource directly or wrapped in .data
      // @ts-expect-error - backend response shape mismatch
      return response?.data ?? response;
    } catch (error) {
      // If backend does not implement mark-as-read, degrade gracefully by returning a local shape
      console.warn('markNotificationAsRead failed, falling back to optimistic update', error);
      return { id, read: true } as unknown as Notification;
    }
  }

  async deleteNotification(id: string): Promise<void> {
    await apiClient.delete(`${this.baseUrl}/${id}`);
  }

  async createNotification(userId: string, message: string, title: string = 'Notification', type: 'info' | 'success' | 'warning' | 'error' = 'info', actionUrl?: string): Promise<Notification> {
    const payload = {
      userId,
      title,
      content: message,
      type,
      actionUrl
    };
    const response = await apiClient.post<unknown>(this.baseUrl, payload);
    // @ts-expect-error - backend response shape mismatch
    return response?.data ?? response;
  }
}

export const notificationService = new NotificationService();

// Convenience named exports
export const getNotifications = (page = 1, limit = 10) =>
  notificationService.getNotifications(page, limit);
export const markNotificationAsRead = (id: string) =>
  notificationService.markNotificationAsRead(id);
export const deleteNotification = (id: string) => notificationService.deleteNotification(id);
export const createNotification = (userId: string, message: string, title?: string, type?: 'info' | 'success' | 'warning' | 'error', actionUrl?: string) =>
  notificationService.createNotification(userId, message, title, type, actionUrl);

// markAllNotificationsAsRead is implemented on the backend in some apps; provide a local passthrough if needed
export const markAllNotificationsAsRead = async () => {
  // For now, call the list endpoint and mark each as read sequentially (not ideal but compatible)
  const notifications = await notificationService.getNotifications(1, 100);
  await Promise.all(notifications.map(n => notificationService.markNotificationAsRead(n.id)));
};
