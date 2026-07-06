import { create } from 'zustand';
import api from '../api';

export interface AppNotification {
  id: string;
  userId: string;
  type: 'TASK_ASSIGNED' | 'TASK_OVERDUE' | 'TASK_UPDATED' | 'TASK_COMMENT' | 'CHAT_MENTION' | 'ATTENDANCE_ALERT' | 'ANNOUNCEMENT';
  title: string;
  body: string;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  totalPages: number;
  totalCount: number;
  isLoading: boolean;

  fetchNotifications: (page?: number, type?: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  addNotification: (notification: AppNotification) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  totalPages: 1,
  totalCount: 0,
  isLoading: false,

  fetchNotifications: async (page = 1, type = 'All') => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/api/notifications`, {
        params: { page, type }
      });

      // Calculate unread count (from database, or fetch unread-only separately)
      // Since it is paginated, let's also fetch another query for total unread or filter locally
      const unread = data.notifications.filter((n: AppNotification) => !n.isRead).length;

      // We can also fetch the total unread from a separate count if we want, but let's query page 1
      // and use the API response totalCount/unread for simplicity.
      
      set({
        notifications: data.notifications,
        unreadCount: type === 'All' 
          ? data.notifications.filter((n: AppNotification) => !n.isRead).length 
          : get().unreadCount, // retain or approximate
        totalPages: data.pagination.totalPages,
        totalCount: data.pagination.totalCount,
        isLoading: false
      });
      
      // Let's query just the unread ones to get an accurate count of total unreads across all pages
      if (page === 1) {
        const { data: unreadData } = await api.get(`/api/notifications`, { params: { type: 'Unread', limit: 100 } });
        set({ unreadCount: unreadData.pagination.totalCount });
      }
    } catch (err) {
      set({ isLoading: false });
    }
  },

  markRead: async (id) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      set((state) => ({
        notifications: state.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (err) {
      console.error(err);
    }
  },

  markAllRead: async () => {
    try {
      await api.patch(`/api/notifications/read-all`);
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0
      }));
    } catch (err) {
      console.error(err);
    }
  },

  addNotification: (notification) => {
    // Check if notification already exists
    const exists = get().notifications.some((n) => n.id === notification.id);
    if (exists) return;

    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
      totalCount: state.totalCount + 1
    }));

    // Optional audio tone / notify sound (can be added on UI)
  }
}));
export type NotificationType = AppNotification['type'];
