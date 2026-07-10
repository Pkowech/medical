export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  userId: string;
  metadata?: {
    title?: string;
    actionUrl?: string;
    [key: string]: any;
  };
}

export interface NotificationResponse {
  success: boolean;
  data: Notification;
}

export interface NotificationsListResponse {
  success: boolean;
  data: Notification[];
  total: number;
  page: number;
  limit: number;
}
