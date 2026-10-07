import { buildAction, type HelperRpc, type QueuedAction } from '@sst/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { useCallback } from 'react';
import { drainNow, refreshQueueState } from './runner';
import { sqliteStore } from './sqliteStore';

export const QUEUE_KEY = ['queue'] as const;

/** Every queued action (pending and failed). The trip views overlay these on server data. */
export function useQueuedActions() {
  return useQuery({ queryKey: QUEUE_KEY, queryFn: () => sqliteStore.list(), staleTime: 0 });
}

/** The last known position, waiting at most `timeoutMs`. Null if there is none or no permission. */
async function lastKnownPosition(timeoutMs: number): Promise<{ lat: number; lng: number } | null> {
  try {
    const position = await Promise.race([
      Location.getLastKnownPositionAsync(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null;
  } catch {
    return null;
  }
}

/**
 * Returns `run(rpc, args)`: queues the action, updates the local view immediately and tries to
 * send it. It never throws for network problems; the queue retries later.
 */
export function useHelperAction() {
  const queryClient = useQueryClient();

  return useCallback(
    async (rpc: HelperRpc, args: Record<string, unknown>): Promise<QueuedAction> => {
      const position = await lastKnownPosition(1500);
      const action = buildAction(rpc, args, {
        id: Crypto.randomUUID(),
        now: new Date(),
        lat: position?.lat ?? null,
        lng: position?.lng ?? null,
      });
      await sqliteStore.put(action);
      await refreshQueueState();
      await queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
      void drainNow(queryClient);
      return action;
    },
    [queryClient],
  );
}
