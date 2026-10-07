import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from '@/state/session';

export default function AdminLayout() {
  const setLastRole = useSession((s) => s.setLastRole);
  useEffect(() => {
    setLastRole('admin');
  }, [setLastRole]);
  return <Stack screenOptions={{ headerShown: false }} />;
}
