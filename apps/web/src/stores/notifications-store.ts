import { create } from 'zustand';

import { logger } from '@/lib/logger';
import { notificationsService } from '@/services/notifications-service';
import type { Notification } from '@/types';

const MAX_CONSECUTIVE_POLL_FAILURES = 5;

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isDropdownOpen: boolean;
  pollingInterval: ReturnType<typeof setInterval> | null;
  consecutivePollFailures: number;

  fetchNotifications: () => Promise<void>;
  fetchSummary: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  setDropdownOpen: (open: boolean) => void;
  startPolling: () => void;
  stopPolling: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isDropdownOpen: false,
  pollingInterval: null,
  consecutivePollFailures: 0,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const notifications = await notificationsService.getAll();
      const unreadCount = notifications.filter((n) => !n.is_read).length;
      set({ notifications, unreadCount, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchSummary: async () => {
    try {
      const summary = await notificationsService.getSummary();
      set({ unreadCount: summary.unread_count, consecutivePollFailures: 0 });
    } catch {
      const failures = get().consecutivePollFailures + 1;
      set({ consecutivePollFailures: failures });
      if (failures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        logger.warn(
          '[NotificationsStore] Stopping polling after repeated summary fetch failures'
        );
        get().stopPolling();
      }
    }
  },

  markAsRead: async (id: number) => {
    try {
      await notificationsService.markAsRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // Silently fail
    }
  },

  markAllAsRead: async () => {
    try {
      await notificationsService.markAllAsRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          is_read: true,
        })),
        unreadCount: 0,
      }));
    } catch {
      // Silently fail
    }
  },

  setDropdownOpen: (open: boolean) => {
    set({ isDropdownOpen: open });
    if (open) {
      void get().fetchNotifications();
    }
  },

  startPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) return;

    set({ consecutivePollFailures: 0 });

    // Initial fetch
    void get().fetchSummary();

    const interval = setInterval(() => {
      void get().fetchSummary();
    }, 60000); // 60 seconds

    set({ pollingInterval: interval });
  },

  stopPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) {
      clearInterval(pollingInterval);
      set({ pollingInterval: null });
    }
  },
}));
