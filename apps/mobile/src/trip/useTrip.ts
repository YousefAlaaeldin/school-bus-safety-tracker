import {
  applyPending,
  counts,
  groupByStop,
  type StudentRow,
  type StudentTripStatus,
  type TripDirection,
  type TripRow,
  type TripStatus,
} from '@sst/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useQueuedActions } from '@/queue/useHelperAction';

export type TripStop = {
  id: string;
  label_ar: string;
  label_en: string;
  area: string | null;
  building: string | null;
  landmark_notes: string | null;
  is_school: boolean;
  lat: number;
  lng: number;
};

export type TripMeta = TripRow & {
  school_id: string;
  scheduled_departure: string;
  arrived_school_at: string | null;
  bus: { label_ar: string; label_en: string } | null;
  route: { name_ar: string; name_en: string; id: string } | null;
};

export type TripStudentRow = StudentRow & {
  boarded_at: string | null;
  dropped_at: string | null;
  drop_distance_m: number | null;
};

type TripData = {
  trip: TripMeta;
  students: TripStudentRow[];
  stops: Record<string, TripStop>;
  /** Stops of the route in driving order (includes the school stop). */
  routeStopIds: string[];
  dropDistanceWarningM: number;
};

async function loadTrip(tripId: string): Promise<TripData> {
  const { data: trip, error } = await supabase
    .from('trips')
    .select(
      'id, direction, status, school_id, scheduled_departure, arrived_school_at, bus:buses(label_ar, label_en), route:routes(id, name_ar, name_en), school:schools(drop_distance_warning_m)',
    )
    .eq('id', tripId)
    .single();
  if (error) throw error;

  const { data: rows, error: rowsError } = await supabase
    .from('trip_students')
    .select(
      'student_id, stop_id, stop_sequence, status, boarded_at, dropped_at, drop_distance_m, students(name_ar, name_en, photo_path)',
    )
    .eq('trip_id', tripId);
  if (rowsError) throw rowsError;

  const routeId = trip.route?.id;
  const { data: routeStops } = routeId
    ? await supabase.from('route_stops').select('stop_id, sequence').eq('route_id', routeId).order('sequence')
    : { data: [] as { stop_id: string; sequence: number }[] };
  const routeStopIds = (routeStops ?? []).map((r) => r.stop_id);

  const stopIds = [...new Set([...routeStopIds, ...(rows ?? []).map((r) => r.stop_id)])];
  const { data: stopRows, error: stopsError } = stopIds.length
    ? await supabase
        .from('stops_with_coords')
        .select('id, label_ar, label_en, area, building, landmark_notes, is_school, lat, lng')
        .in('id', stopIds)
    : { data: [], error: null };
  if (stopsError) throw stopsError;

  const stops: Record<string, TripStop> = {};
  for (const s of stopRows ?? []) {
    if (s.id && s.lat != null && s.lng != null) {
      stops[s.id] = {
        id: s.id,
        label_ar: s.label_ar ?? '',
        label_en: s.label_en ?? '',
        area: s.area,
        building: s.building,
        landmark_notes: s.landmark_notes,
        is_school: s.is_school ?? false,
        lat: s.lat,
        lng: s.lng,
      };
    }
  }

  return {
    trip: {
      id: trip.id,
      direction: trip.direction as TripDirection,
      status: trip.status as TripStatus,
      school_id: trip.school_id,
      scheduled_departure: trip.scheduled_departure,
      arrived_school_at: trip.arrived_school_at,
      bus: trip.bus,
      route: trip.route,
    },
    students: (rows ?? []).map((r) => ({
      student_id: r.student_id,
      stop_id: r.stop_id,
      stop_sequence: r.stop_sequence,
      status: r.status as StudentTripStatus,
      name_ar: r.students?.name_ar ?? '',
      name_en: r.students?.name_en ?? '',
      photo_path: r.students?.photo_path ?? null,
      boarded_at: r.boarded_at,
      dropped_at: r.dropped_at,
      drop_distance_m: r.drop_distance_m,
    })),
    stops,
    routeStopIds,
    dropDistanceWarningM: trip.school?.drop_distance_warning_m ?? 200,
  };
}

/** One trip, with queued (not yet synced) actions applied on top of the server data. */
export function useTrip(tripId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['trip', tripId], queryFn: () => loadTrip(tripId), enabled: !!tripId });
  const queued = useQueuedActions();

  useEffect(() => {
    if (!tripId) return;
    const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
    const channel = supabase
      .channel(`trip-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_students', filter: `trip_id=eq.${tripId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, invalidate)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tripId, queryClient]);

  const view = useMemo(() => {
    const data = query.data;
    if (!data) return null;
    const { trip, students } = applyPending(data.trip, data.students, queued.data ?? []);
    const extra = new Map(data.students.map((s) => [s.student_id, s]));
    const merged = students.map((s) => ({ ...s, ...pick(extra.get(s.student_id)) }));
    return {
      trip: { ...data.trip, ...trip },
      students: merged,
      groups: groupByStop(merged),
      counts: counts(merged),
      stops: data.stops,
      routeStopIds: data.routeStopIds,
      dropDistanceWarningM: data.dropDistanceWarningM,
    };
  }, [query.data, queued.data]);

  return {
    ...view,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

function pick(row: TripStudentRow | undefined) {
  return {
    boarded_at: row?.boarded_at ?? null,
    dropped_at: row?.dropped_at ?? null,
    drop_distance_m: row?.drop_distance_m ?? null,
  };
}
