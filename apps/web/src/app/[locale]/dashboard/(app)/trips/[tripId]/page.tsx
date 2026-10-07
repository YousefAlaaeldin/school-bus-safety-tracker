import { formatTime } from '@sst/i18n';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { RealtimeRefresh } from '@/components/dashboard/RealtimeRefresh';
import { TripTimeline } from '@/components/dashboard/TripTimeline';
import { Badge, statusBadgeColor } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient } from '@/lib/supabase/server';

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ locale: string; tripId: string }>;
}) {
  const { locale, tripId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('dashboard.tripDetail');
  const studentStatusT = await getTranslations('status.student');
  const tripStatusT = await getTranslations('status.trip');
  const { schoolId } = await requireAdmin(locale);
  const ar = locale === 'ar';
  const lang = ar ? 'ar' : 'en';

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from('trips')
    .select('id, status, direction, scheduled_departure, route:routes(name_ar, name_en), bus:buses(label_ar, label_en), school:schools(drop_distance_warning_m)')
    .eq('id', tripId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (!trip) notFound();

  const [{ data: rows }, { data: events }] = await Promise.all([
    supabase
      .from('trip_students')
      .select('student_id, status, boarded_at, dropped_at, drop_distance_m, stop_sequence, student:students(name_ar, name_en), stop:stops(label_ar, label_en)')
      .eq('trip_id', tripId)
      .order('stop_sequence'),
    supabase
      .from('trip_events')
      .select('id, type, server_time, device_time, location, student:students(name_ar, name_en), actor:profiles(display_name, phone)')
      .eq('trip_id', tripId)
      .order('server_time'),
  ]);

  const threshold = trip.school?.drop_distance_warning_m ?? 200;
  const time = (iso: string | null) => (iso ? <span dir="ltr">{formatTime(iso, lang)}</span> : '');

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh table="trip_students" filter={`trip_id=eq.${tripId}`} />
      <RealtimeRefresh table="trip_events" filter={`trip_id=eq.${tripId}`} />

      <div className="flex flex-col gap-1">
        <Link href="/dashboard/trips" className="text-sm text-emerald-800 hover:underline">{t('back')}</Link>
        <h1 className="text-2xl font-bold">
          {ar ? trip.route?.name_ar : trip.route?.name_en} · {ar ? trip.bus?.label_ar : trip.bus?.label_en}
        </h1>
        <div>
          <Badge color={statusBadgeColor(trip.status)}>{tripStatusT(trip.status)}</Badge>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">{t('students')}</h2>
        <Table
          rows={rows ?? []}
          rowKey={(r) => r.student_id}
          columns={[
            { key: 'student', header: t('student'), render: (r) => (ar ? r.student?.name_ar : r.student?.name_en) },
            { key: 'stop', header: t('stop'), render: (r) => `${r.stop_sequence}. ${ar ? r.stop?.label_ar : r.stop?.label_en}` },
            {
              key: 'status',
              header: t('status'),
              render: (r) => <Badge color={statusBadgeColor(r.status)}>{studentStatusT(r.status)}</Badge>,
            },
            { key: 'boarded', header: t('boardedAt'), render: (r) => time(r.boarded_at) },
            { key: 'dropped', header: t('droppedAt'), render: (r) => time(r.dropped_at) },
            {
              key: 'distance',
              header: t('distance'),
              render: (r) =>
                r.drop_distance_m == null ? (
                  ''
                ) : (
                  <span className={r.drop_distance_m > threshold ? 'font-bold text-red-700' : ''}>
                    {t('meters', { count: r.drop_distance_m })}
                  </span>
                ),
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t('timeline')}</h2>
        <TripTimeline
          locale={lang}
          events={(events ?? []).map((e) => ({
            id: e.id,
            type: e.type,
            server_time: e.server_time,
            device_time: e.device_time,
            location: e.location as unknown as string | null,
            studentName: e.student ? (ar ? e.student.name_ar : e.student.name_en) : null,
            actorName: e.actor?.display_name ?? e.actor?.phone ?? null,
          }))}
        />
      </section>
    </div>
  );
}
