import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { RouteAssignments, type Assignment } from '@/components/dashboard/RouteAssignments';
import { RouteScheduleEditor } from '@/components/dashboard/RouteScheduleEditor';
import { RouteStopsEditor } from '@/components/dashboard/RouteStopsEditor';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient } from '@/lib/supabase/server';

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ locale: string; routeId: string }>;
}) {
  const { locale, routeId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('dashboard.route');
  const { schoolId } = await requireAdmin(locale);
  const ar = locale === 'ar';

  const supabase = await createClient();
  const { data: route } = await supabase
    .from('routes')
    .select('id, name_ar, name_en, direction, bus:buses(label_ar, label_en)')
    .eq('id', routeId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (!route) notFound();

  const [{ data: routeStops }, { data: allStops }, { data: schedules }, { data: assignRows }, { data: students }] = await Promise.all([
    supabase.from('route_stops').select('stop_id, sequence').eq('route_id', routeId).order('sequence'),
    supabase.from('stops').select('id, label_ar, label_en, is_school').eq('school_id', schoolId).order('label_en'),
    supabase.from('route_schedules').select('weekday, departure_time').eq('route_id', routeId),
    supabase
      .from('student_assignments')
      .select('id, student_id, stop_id, weekdays, valid_from, student:students(name_ar, name_en)')
      .eq('route_id', routeId)
      .order('created_at'),
    supabase.from('students').select('id, name_ar, name_en').eq('school_id', schoolId).eq('active', true).order('name_en'),
  ]);

  const toStop = (s: { id: string; label_ar: string; label_en: string; is_school: boolean }) => ({
    id: s.id,
    label: ar ? s.label_ar : s.label_en,
    isSchool: s.is_school,
  });
  const byId = new Map((allStops ?? []).map((s) => [s.id, s]));
  const initialStops = (routeStops ?? []).flatMap((rs) => {
    const s = byId.get(rs.stop_id);
    return s ? [toStop(s)] : [];
  });
  const initialTimes: Record<number, string> = {};
  for (const s of schedules ?? []) initialTimes[s.weekday] = s.departure_time.slice(0, 5);

  const stopLabel = new Map((allStops ?? []).map((st) => [st.id, ar ? st.label_ar : st.label_en]));
  const assignments: Assignment[] = (assignRows ?? []).map((a) => ({
    id: a.id,
    studentId: a.student_id,
    studentName: (ar ? a.student?.name_ar : a.student?.name_en) ?? '',
    stopId: a.stop_id,
    stopLabel: stopLabel.get(a.stop_id) ?? '',
    weekdays: a.weekdays,
    validFrom: a.valid_from,
  }));
  const assignedIds = new Set(assignments.map((a) => a.studentId));
  const pickable = (students ?? [])
    .filter((st) => !assignedIds.has(st.id))
    .map((st) => ({ id: st.id, label: ar ? st.name_ar : st.name_en }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link href="/dashboard/routes" className="text-sm text-emerald-800 hover:underline">{t('back')}</Link>
        <h1 className="text-2xl font-bold">
          {ar ? route.name_ar : route.name_en} · {ar ? route.bus?.label_ar : route.bus?.label_en}
        </h1>
      </div>

      <RouteStopsEditor
        routeId={routeId}
        direction={route.direction}
        initial={initialStops}
        available={(allStops ?? []).map(toStop)}
      />
      <RouteScheduleEditor routeId={routeId} initial={initialTimes} />
      <RouteAssignments
        routeId={routeId}
        assignments={assignments}
        students={[
          ...pickable,
          ...assignments.map((a) => ({ id: a.studentId, label: a.studentName })),
        ]}
        routeStops={initialStops.map((st) => ({ id: st.id, label: st.label }))}
      />
    </div>
  );
}
