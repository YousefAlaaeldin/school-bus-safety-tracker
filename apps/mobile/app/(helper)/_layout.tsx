import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { startQueueRunner } from '@/queue/runner';
import { SyncBadge } from '@/queue/SyncBadge';
import { useSession } from '@/state/session';
import { spacing } from '@/ui/tokens';

export default function HelperLayout() {
  const setLastRole = useSession((s) => s.setLastRole);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setLastRole('helper');
  }, [setLastRole]);

  useEffect(() => startQueueRunner(queryClient), [queryClient]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      {/* The sync badge sits at the top end of every helper screen. */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + spacing[2], end: spacing[4] }}>
        <SyncBadge />
      </View>
    </View>
  );
}
