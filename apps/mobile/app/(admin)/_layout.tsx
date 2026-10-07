import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { setSentryRole } from '@/lib/sentry';
import { useSession } from '@/state/session';

export default function AdminLayout() {
  const setLastRole = useSession((s) => s.setLastRole);
  useEffect(() => {
    setLastRole('admin');
    setSentryRole('admin');
  }, [setLastRole]);
  return <Stack screenOptions={{ headerShown: false }} />;
}
