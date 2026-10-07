import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { setSentryRole } from '@/lib/sentry';
import { useSession } from '@/state/session';

export default function ParentLayout() {
  const setLastRole = useSession((s) => s.setLastRole);
  useEffect(() => {
    setLastRole('parent');
    setSentryRole('parent');
  }, [setLastRole]);
  return <Stack screenOptions={{ headerShown: false }} />;
}
