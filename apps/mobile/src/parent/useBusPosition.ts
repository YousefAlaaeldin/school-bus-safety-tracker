import { canTrackBus, type StudentTripStatus, type TripDirection, type TripStatus } from '@sst/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type BusPosition = { lat: number; lng: number; heading: number | null; recordedAt: string };

type MyChild = {
  student_id: string;
  stop_id: string;
  status: StudentTripStatus;
  eta_at: string | null;
  eta_source: 'routes_api' | 'fallback' | null;
  name_ar: string;
  name_en: string;
  stop: { label_ar: string; label_en: string; lat: number; lng: number } | null;
};

type TripView = {
  direction: TripDirection;
  status: TripStatus;
  bus: { label_ar: string; label_en: string } | null;
  children: MyChild[];
};

/** My children on this trip (RLS returns only mine) with their stops. Never other children. */
async function loadTripView(tripId: string): Promise<TripView> {
  const { data: trip, error } = await supabase
    .from('trips')
    .select('direction, status, bus:buses(label_ar, label_en)')
    .eq('id', tripId)
    .single();
  if (error) throw error;

  const { data: rows, error: rowsError } = await supabase
    .from('trip_students')
    .select('student_id, stop_id, status, eta_at, eta_source, students(name_ar, name_en)')
    .eq('trip_id', tripId);
  if (rowsError) throw rowsError;

  const stopIds = [...new Set((rows ?? []).map((r) => r.stop_id))];
  const { data: stopRows, error: stopsError } = stopIds.length
    ? await supabase.from('stops_with_coords').select('id, label_ar, label_en, lat, lng').in('id', stopIds)
    : { data: [], error: null };
  if (stopsError) throw stopsError;
  const stops = new Map((stopRows ?? []).map((s) => [s.id, s]));

  return {
    direction: trip.direction as TripDirection,
    status: trip.status as TripStatus,
    bus: trip.bus,
    children: (rows ?? []).map((r) => {
      const s = stops.get(r.stop_id);
      return {
        student_id: r.student_id,
        stop_id: r.stop_id,
        status: r.status as StudentTripStatus,
        eta_at: r.eta_at,
        eta_source: r.eta_source,
        name_ar: r.students?.name_ar ?? '',
        name_en: r.students?.name_en ?? '',
        stop: s && s.lat != null && s.lng != null ? { label_ar: s.label_ar ?? '', label_en: s.label_en ?? '', lat: s.lat, lng: s.lng } : null,
      };
    }),
  };
}

/**
 * The bus position for a trip: an initial select plus a Realtime subscription filtered by trip.
 * `notPermitted` means there is no visible position and none of my children is on board any more
 * (RLS stops returning the row, so the screen shows "tracking has ended").
 */
export function useBusPosition(tripId: string) {
  const queryClient = useQueryClient();
  const [position, setPosition] = useState<BusPosition | null>(null);
  const [loaded, setLoaded] = useState(false);

  const view = useQuery({ queryKey: ['trip', tripId, 'parent-view'], queryFn: () => loadTripView(tripId), enabled: !!tripId });

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    const apply = (row: { lat: number; lng: number; heading: number | null; recorded_at: string }) =>
      setPosition({ lat: row.lat, lng: row.lng, heading: row.heading, recordedAt: row.recorded_at });

    void supabase
      .from('bus_positions')
      .select('lat, lng, heading, recorded_at')
      .eq('trip_id', tripId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setPosition(data ? { lat: data.lat, lng: data.lng, heading: data.heading, recordedAt: data.recorded_at } : null);
        setLoaded(true);
      });

    const channel = supabase
      .channel(`bus-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bus_positions', filter: `trip_id=eq.${tripId}` }, (payload) => {
        if (payload.eventType === 'DELETE') return setPosition(null);
        apply(payload.new as { lat: number; lng: number; heading: number | null; recorded_at: string });
      })
      // Boarding and status changes decide whether tracking is still allowed.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_students', filter: `trip_id=eq.${tripId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'parent-view'] });
      })
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [tripId, queryClient]);

  const data = view.data;
  const stillAllowed = !!data && data.children.some((c) => canTrackBus({ direction: data.direction, tripStatus: data.status, studentStatus: c.status }));
  const notPermitted = loaded && !!data && !position && !stillAllowed;

  return {
    position,
    lastUpdate: position?.recordedAt ?? null,
    notPermitted,
    view: data ?? null,
    loading: !loaded || view.isLoading,
    error: view.error,
    refetch: view.refetch,
  };
}
