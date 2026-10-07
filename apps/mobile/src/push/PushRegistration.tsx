import { useEffect } from 'react';
import { useMyContext } from '@/auth/useMyContext';
import { useNotificationRouting } from './useNotificationRouting';
import { registerForPush, watchPushToken } from './registerPush';

/** Registers the device for push after sign-in (all roles), keeps the token fresh and routes notification taps. */
export function PushRegistration() {
  const ctx = useMyContext(true);
  const uid = ctx.data?.profile.id;
  useNotificationRouting(!!uid);

  useEffect(() => {
    if (!uid) return;
    void registerForPush();
    return watchPushToken();
  }, [uid]);

  return null;
}
