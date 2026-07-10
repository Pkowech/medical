import { notificationService } from './notificationService';
import apiClient from '../auth/services/apiClient';

jest.mock('../auth/services/apiClient');

describe('NotificationService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch notifications with default pagination', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: [] });

    const notifications = await notificationService.getNotifications();

    expect(apiClient.get).toHaveBeenCalledWith('/notifications?page=1&limit=10');
    expect(notifications).toEqual([]);
  });

  it('should fetch notifications with specified pagination', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: [] });

    const notifications = await notificationService.getNotifications(2, 5);

    expect(apiClient.get).toHaveBeenCalledWith('/notifications?page=2&limit=5');
    expect(notifications).toEqual([]);
  });

  it('should map metadata.title to title if it exists', async () => {
    const mockNotifications = [
      { id: '1', metadata: { title: 'Test Notification 1' }, read: false },
      { id: '2', read: true },
    ];
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockNotifications });

    const notifications = await notificationService.getNotifications();

    expect(notifications).toEqual([
      {
        id: '1',
        metadata: { title: 'Test Notification 1' },
        read: false,
        title: 'Test Notification 1',
      },
      { id: '2', read: true, title: 'Notification' },
    ]);
  });
});
