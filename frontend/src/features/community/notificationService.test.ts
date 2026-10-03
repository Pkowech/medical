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

  it('should preserve an existing title when metadata also has a title', async () => {
    const notification = {
      id: '1',
      title: 'Existing title',
      metadata: { title: 'Metadata title' },
      read: false,
    };
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: [notification] });

    const notifications = await notificationService.getNotifications();

    expect(notifications[0].title).toBe('Existing title');
    expect(notifications[0].metadata).toEqual({ title: 'Metadata title' });
  });

  it('should preserve notification fields while applying the fallback title', async () => {
    const notification = {
      id: '2',
      message: 'A course update is available',
      read: true,
      userId: 'user-1',
    };
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: [notification] });

    const notifications = await notificationService.getNotifications();

    expect(notifications[0]).toEqual({
      ...notification,
      title: 'Notification',
    });
  });

  it('should normalize notifications returned as a direct array', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce([
      { id: '3', metadata: { title: 'Direct response title' }, read: false },
    ]);

    const notifications = await notificationService.getNotifications();

    expect(notifications).toEqual([
      {
        id: '3',
        metadata: { title: 'Direct response title' },
        read: false,
        title: 'Direct response title',
      },
    ]);
  });
});
