'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { BusesMap, type BusMarker } from '@/components/maps/BusesMap';
import { Badge, statusBadgeColor } from '@/components/ui/Badge';
import { Link, useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

export type LiveTrip = {
  id: string;
  status: string;
  busLabel: string;
  routeName: string;
  boarded: number;
  missing: number;
  dropped: number;
  openAlerts: number;
};

export type LivePosition = { trip_id: string; lat: number; lng: number; recorded_at: string };

const STALE_MS = 2 * 60 * 1000;

export function LiveBoard({
  schoolId,
  trips,
  positions: initialPositions,
}: {
  schoolId: string;
  trips: LiveTrip[];
  positions: LivePosition[];
}) {
  const t = useTranslations('dashboard.live');
  const statusT = useTranslations('status.trip');
  const router = useRouter();
  const [positions, setPositions] = useState<Record<string, LivePosition>>(
    Object.fromEntries(initialPositions.map((p) => [p.trip_id, p])),
  );
  const [now, setNow] = useState(() => Date.now());
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  // "x s ago" ticks every 5 seconds.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`live-${schoolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bus_positions', filter: `school_id=eq.${schoolId}` }, (payload) => {
        const row = payload.new as Partial<LivePosition>;
        if (row.trip_id && row.lat != null && row.lng != null && row.recorded_at) {
          setPositions((p) => ({ ...p, [row.trip_id!]: row as LivePosition }));
        }
      })
      // Counts and statuses come from the server page.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `school_id=eq.${schoolId}` }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_students' }, () => router.refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [schoolId, router]);

  const markers: BusMarker[] = useMemo(
    () =>
      trips.flatMap((trip) => {
        const p = positions[trip.id];
        if (!p) return [];
        return [
          {
            tripId: trip.id,
            label: trip.busLabel,
            lat: p.lat,
            lng: p.lng,
            stale: now - new Date(p.recorded_at).getTime() > STALE_MS,
          },
        ];
      }),
    [trips, positions, now],
  );

  return (
    <div className="flex flex-col gap-4">
      {apiKey ? (
        <BusesMap markers={markers} apiKey={apiKey} />
      ) : (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-600">{t('noMapKey')}</p>
      )}

      {trips.length === 0 ? <p className="text-neutral-600">{t('noTrips')}</p> : null}

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {trips.map((trip) => {
          const p = positions[trip.id];
          const seconds = p ? Math.max(0, Math.round((now - new Date(p.recorded_at).getTime()) / 1000)) : null;
          return (
            <li key={trip.id} className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{trip.busLabel}</span>
                <Badge color={statusBadgeColor(trip.status)}>{statusT(trip.status)}</Badge>
              </div>
              <span className="text-sm text-neutral-600">{trip.routeName}</span>
              <span className="text-sm">
                {t('onBoard')}: <b>{trip.boarded}</b> · {t('missing')}: <b>{trip.missing}</b> · {t('dropped')}: <b>{trip.dropped}</b>
              </span>
              <span className="text-xs text-neutral-500">
                {seconds === null ? t('noPosition') : t('updated', { seconds })}
              </span>
              <div className="flex items-center justify-between">
                {trip.openAlerts > 0 ? (
                  <span className="text-sm font-medium text-red-700">{t('alerts', { count: trip.openAlerts })}</span>
                ) : (
                  <span />
                )}
                <Link href={`/dashboard/trips/${trip.id}`} className="text-sm font-medium text-emerald-800 hover:underline">
                  {t('details')}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
