'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../lib/api';

export const NOTIFICATIONS_COUNT_UPDATED_EVENT = 'notifications:count-updated';

const readCountFromEvent = (event: Event): number | null => {
  const customEvent = event as CustomEvent<{ unreadCount?: number }>;
  const nextCount = customEvent.detail?.unreadCount;
  return typeof nextCount === 'number' ? nextCount : null;
};

export default function useUnreadNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const response = await api.get('/notifications');
      const nextCount = Number(response.data?.unreadCount || 0);
      setUnreadCount(nextCount);
      return nextCount;
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    const onCountUpdated = (event: Event) => {
      const nextCount = readCountFromEvent(event);
      if (nextCount === null) return;
      setUnreadCount(nextCount);
    };

    window.addEventListener(NOTIFICATIONS_COUNT_UPDATED_EVENT, onCountUpdated);
    return () => {
      window.removeEventListener(NOTIFICATIONS_COUNT_UPDATED_EVENT, onCountUpdated);
    };
  }, []);

  return {
    unreadCount,
    refreshUnreadCount,
  };
}
