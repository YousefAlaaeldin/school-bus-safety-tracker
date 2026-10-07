import { drain, type QueuedAction } from '@sst/shared';
import NetInfo from '@react-native-community/netinfo';
import type { QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { sqliteStore } from './sqliteStore';

type QueueState = {
  pendingCount: number;
  failed: QueuedAction[];
  online: boolean;
};

export const useQueueStore = create<QueueState>(() => ({ pendingCount: 0, failed: [], online: true }));

/** Re-reads the queue and updates the badge state. */
export async function refreshQueueState(): Promise<QueuedAction[]> {
  const all = await sqliteStore.list();
  useQueueStore.setState({
    pendingCount: all.filter((a) => a.state === 'pending').length,
    failed: all.filter((a) => a.state === 'failed'),
  });
  return all;
}

let draining = false;

/** Sends queued actions oldest-first. Single-flight: never two drains at once. */
export async function drainNow(queryClient?: QueryClient): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    const before = await sqliteStore.list();
    const tripIds = new Set(
      before.map((a) => a.args.p_trip_id).filter((id): id is string => typeof id === 'string'),
    );
    await drain(sqliteStore, async (rpc, args) => {
      // The helper RPC names and arguments are validated by the queue, so the generated
      // overloads cannot be matched statically here.
      const { error } = await supabase.rpc(rpc as never, args as never);
      return { error: error ? { message: error.message } : null };
    });
    await refreshQueueState();
    if (queryClient) {
      void queryClient.invalidateQueries({ queryKey: ['queue'] });
      for (const id of tripIds) void queryClient.invalidateQueries({ queryKey: ['trip', id] });
    }
  } catch {
    // A thrown error counts as a network problem; drain() already kept the queue intact.
  } finally {
    draining = false;
  }
}

let started: (() => void) | null = null;

/** Drains on start, every 15 s, when the network returns and when the app becomes active. */
export function startQueueRunner(queryClient: QueryClient): () => void {
  if (started) return started;

  void refreshQueueState();
  void drainNow(queryClient);

  const interval = setInterval(() => void drainNow(queryClient), 15_000);
  const unsubscribeNet = NetInfo.addEventListener((state) => {
    const online = state.isConnected !== false && state.isInternetReachable !== false;
    const wasOnline = useQueueStore.getState().online;
    useQueueStore.setState({ online });
    if (online && !wasOnline) void drainNow(queryClient);
  });
  const appState = AppState.addEventListener('change', (s) => {
    if (s === 'active') void drainNow(queryClient);
  });

  const stop = () => {
    clearInterval(interval);
    unsubscribeNet();
    appState.remove();
    started = null;
  };
  started = stop;
  return stop;
}
