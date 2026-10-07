import { useEffect } from 'react';
import { useMyContext } from '@/auth/useMyContext';
import { registerForPush, watchPushToken } from './registerPush';

/** Registers the device for push once the user is signed in (all roles) and keeps the token fresh. */
export function PushRegistration() {
  const ctx = useMyContext(true);
  const uid = ctx.data?.profile.id;

  useEffect(() => {
    if (!uid) return;
    void registerForPush();
    return watchPushToken();
  }, [uid]);

  return null;
}
