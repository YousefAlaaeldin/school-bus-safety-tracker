import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RPC_ERROR_CODES, type Database, type RpcErrorCode } from '@sst/shared';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh tokens while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});

/** Maps a thrown error or a PostgREST error to an `errors.<CODE>` i18n key suffix. */
export function rpcError(e: unknown): RpcErrorCode | 'NETWORK' | 'UNKNOWN' {
  const message =
    typeof e === 'string'
      ? e
      : e && typeof e === 'object' && 'message' in e && typeof e.message === 'string'
        ? e.message
        : '';
  if ((RPC_ERROR_CODES as readonly string[]).includes(message)) return message as RpcErrorCode;
  if (/network|fetch|timeout|failed to connect|offline/i.test(message)) return 'NETWORK';
  return 'UNKNOWN';
}
