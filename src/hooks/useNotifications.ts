import { useEffect } from 'react';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { supabase } from '../../services/db';

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  type: string | null;
  target: string | null;
  expires_at: string | null;
}

export function useNotifications(
  clinicId: string | null,
  showToast: (title: string, message: string, type: string) => void,
) {
  useEffect(() => {
    const channel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload: RealtimePostgresInsertPayload<NotificationRow>) => {
          const notification = payload.new;
          const isExpired = notification.expires_at
            ? new Date(notification.expires_at) < new Date()
            : false;

          if (isExpired) return;

          const target = notification.target ?? 'all';
          if (target === 'all' || target === clinicId) {
            showToast(
              notification.title,
              notification.message,
              notification.type ?? 'info',
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId, showToast]);
}
