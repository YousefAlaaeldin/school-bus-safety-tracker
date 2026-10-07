'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

/** Re-renders the server page when rows of `table` change (optionally filtered, e.g. `trip_id=eq.<id>`). */
export function RealtimeRefresh({ table, filter }: { table: string; filter?: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`refresh-${table}-${filter ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, filter, router]);

  return null;
}
