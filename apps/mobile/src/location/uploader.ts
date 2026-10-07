import { supabase } from '@/lib/supabase';
import { pingQueue } from './pingQueue';

let uploading = false;

/** Uploads queued pings, oldest first, 200 at a time. Stops at the first failure and keeps the rest. */
export async function uploadPings(): Promise<void> {
  if (uploading) return;
  uploading = true;
  try {
    for (;;) {
      const batch = await pingQueue.take(200);
      if (batch.length === 0) return;

      const byTrip = new Map<string, typeof batch>();
      for (const item of batch) byTrip.set(item.tripId, [...(byTrip.get(item.tripId) ?? []), item]);

      for (const [tripId, items] of byTrip) {
        const { error } = await supabase.rpc('ingest_pings', {
          p_trip_id: tripId,
          p_pings: items.map((i) => i.ping),
        });
        if (error) return; // offline or rejected: try again on the next upload
        await pingQueue.remove(items.map((i) => i.id));
      }
    }
  } finally {
    uploading = false;
  }
}
