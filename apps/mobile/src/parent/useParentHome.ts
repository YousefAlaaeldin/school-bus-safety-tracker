import { todayInDubai, type JourneyInput, type StudentTripStatus, type TripDirection, type TripStatus } from '@sst/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type Journey = JourneyInput & { tripId: string; bus: { label_ar: string; label_en: string } | null };

export type Child = {
  id: string;
  name_ar: string;
  name_en: string;
  photo_path: string | null;
  morning: Journey | null;
  afternoon: Journey | null;
};

export const PARENT_HOME_KEY = ['parent-home'] as const;

async function loadParentHome(): Promise<Child[]> {
  const { data: students, error } = await supabase
    .from('students')
    .select('id, name_ar, name_en, photo_path')
    .eq('active', true)
    .order('name_en');
  if (error) throw error;
  if (!students?.length) return [];

  const { data: rows, error: rowsError } = await supabase
    .from('trip_students')
    .select(
      'student_id, status, boarded_at, dropped_at, eta_at, trip:trips!inner(id, direction, status, scheduled_departure, service_date, bus:buses(label_ar, label_en))',
    )
    .in('student_id', students.map((s) => s.id))
    .eq('trip.service_date', todayInDubai(new Date()));
  if (rowsError) throw rowsError;

  return students.map((s) => {
    const mine = (rows ?? []).filter((r) => r.student_id === s.id && r.trip);
    const journey = (direction: TripDirection): Journey | null => {
      const r = mine.find((x) => x.trip?.direction === direction);
      if (!r?.trip) return null;
      return {
        tripId: r.trip.id,
        direction,
        tripStatus: r.trip.status as TripStatus,
        studentStatus: r.status as StudentTripStatus,
        scheduledDeparture: r.trip.scheduled_departure,
        boardedAt: r.boarded_at,
        droppedAt: r.dropped_at,
        etaAt: r.eta_at,
        bus: r.trip.bus,
      };
    };
    return {
      id: s.id,
      name_ar: s.name_ar,
      name_en: s.name_en,
      photo_path: s.photo_path,
      morning: journey('to_school'),
      afternoon: journey('from_school'),
    };
  });
}

/** My children and their two journeys today. Realtime changes (RLS-filtered) refresh it. */
export function useParentHome() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: PARENT_HOME_KEY, queryFn: loadParentHome });

  useEffect(() => {
    const invalidate = () => void queryClient.invalidateQueries({ queryKey: PARENT_HOME_KEY });
    const channel = supabase
      .channel('parent-home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_students' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, invalidate)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
