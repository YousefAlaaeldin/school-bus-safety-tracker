import { notificationHref } from '@sst/shared';
import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

// Show notifications while the app is open, with sound (T3.09).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Routes notification taps (running and cold start) and refreshes parent data when one arrives. */
export function useNotificationRouting(enabled: boolean) {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const open = (response: Notifications.NotificationResponse | null) => {
      const href = notificationHref(response?.notification.request.content.data);
      if (href) router.push(href as Href);
    };

    // Cold start: the app was opened by tapping a notification.
    void Notifications.getLastNotificationResponseAsync().then((last) => {
      if (last) open(last);
    });

    const tap = Notifications.addNotificationResponseReceivedListener(open);
    const received = Notifications.addNotificationReceivedListener((n) => {
      void queryClient.invalidateQueries({ queryKey: ['parent-home'] });
      const tripId = n.request.content.data?.trip_id;
      if (typeof tripId === 'string') void queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
    });
    return () => {
      tap.remove();
      received.remove();
    };
  }, [enabled, router, queryClient]);
}
