import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { startQueueRunner } from '@/queue/runner';
import { useSession } from '@/state/session';

export default function HelperLayout() {
  const setLastRole = useSession((s) => s.setLastRole);
  const queryClient = useQueryClient();

  useEffect(() => {
    setLastRole('helper');
  }, [setLastRole]);

  useEffect(() => startQueueRunner(queryClient), [queryClient]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
