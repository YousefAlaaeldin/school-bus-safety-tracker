import { RPC_ERROR_CODES, type RpcErrorCode } from '../enums';

export const HELPER_RPCS = [
  'start_trip',
  'set_boarded',
  'confirm_roll_call',
  'mark_dropped',
  'undo_dropped',
  'mark_no_show',
  'undo_no_show',
  'arrive_at_school',
  'mark_returned_to_school',
  'end_trip',
] as const;
export type HelperRpc = (typeof HELPER_RPCS)[number];

export type QueuedAction = {
  /** = p_client_action_id (uuid v4) */
  id: string;
  rpc: HelperRpc;
  /** Already includes p_client_action_id, p_device_time, p_lat, p_lng. */
  args: Record<string, unknown>;
  /** ISO, = p_device_time */
  createdAt: string;
  attempts: number;
  state: 'pending' | 'failed';
  /** RPC error code when failed. */
  error?: string;
};

export interface QueueStore {
  /** Any order; drain sorts by createdAt. */
  list(): Promise<QueuedAction[]>;
  /** Insert or replace by id. */
  put(a: QueuedAction): Promise<void>;
  remove(id: string): Promise<void>;
}

export type RpcCaller = (
  rpc: string,
  args: Record<string, unknown>,
) => Promise<{ error: { message: string } | null }>;

export function buildAction(
  rpc: HelperRpc,
  args: Record<string, unknown>,
  ctx: { id: string; now: Date; lat: number | null; lng: number | null },
): QueuedAction {
  const createdAt = ctx.now.toISOString();
  return {
    id: ctx.id,
    rpc,
    args: {
      ...args,
      p_client_action_id: ctx.id,
      p_device_time: createdAt,
      p_lat: ctx.lat,
      p_lng: ctx.lng,
    },
    createdAt,
    attempts: 0,
    state: 'pending',
  };
}

function isRpcErrorCode(message: string): message is RpcErrorCode {
  return (RPC_ERROR_CODES as readonly string[]).includes(message);
}

/** Sends pending actions oldest-first. Stops at the first network failure (keeps order). */
export async function drain(
  store: QueueStore,
  call: RpcCaller,
): Promise<{ sent: number; failed: number; stoppedOnNetwork: boolean }> {
  const all = await store.list();
  const pending = all
    .filter((a) => a.state === 'pending')
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));

  let sent = 0;
  let failed = 0;

  for (const action of pending) {
    let message: string | null;
    try {
      const { error } = await call(action.rpc, action.args);
      message = error ? error.message : null;
    } catch {
      message = '__network__';
    }

    if (message === null) {
      await store.remove(action.id);
      sent += 1;
    } else if (isRpcErrorCode(message)) {
      await store.put({ ...action, state: 'failed', error: message });
      failed += 1;
    } else {
      await store.put({ ...action, attempts: action.attempts + 1 });
      return { sent, failed, stoppedOnNetwork: true };
    }
  }

  return { sent, failed, stoppedOnNetwork: false };
}
