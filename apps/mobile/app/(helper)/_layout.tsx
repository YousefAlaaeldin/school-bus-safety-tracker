import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from '@/state/session';

export default function HelperLayout() {
  const setLastRole = useSession((s) => s.setLastRole);
  useEffect(() => {
    setLastRole('helper');
  }, [setLastRole]);
  return <Stack screenOptions={{ headerShown: false }} />;
}
