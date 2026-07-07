import api from './api';

export interface Notification {
  id: string;
  userId: string;
  followupId: string;
  type: 'overdue' | 'today' | 'tomorrow' | 'warning';
  isRead: boolean;
  createdAt: string;
  followup?: {
    id: string;
    lead?: {
      id: string;
      name: string;
    };
    user?: {
      id: string;
      name: string;
    };
  };
}

export const notificationService = {
  getPendingNotifications: async (): Promise<Notification[]> => {
    const { data } = await api.get('/notifications/pending');
    return data;
  },

  getPendingCount: async (): Promise<number> => {
    const { data } = await api.get('/notifications/pending-count');
    return data.count;
  },

  getNotifications: async (limit = 20): Promise<Notification[]> => {
    const { data } = await api.get('/notifications', { params: { limit } });
    return data;
  },

  markAsRead: async (notificationId: string): Promise<Notification> => {
    const { data } = await api.patch(`/notifications/${notificationId}/read`);
    return data;
  },

  markAllAsRead: async (): Promise<any> => {
    const { data } = await api.patch('/notifications/read-all');
    return data;
  },

  syncNotifications: async (): Promise<any> => {
    const { data } = await api.patch('/notifications/sync');
    return data;
  },
};
