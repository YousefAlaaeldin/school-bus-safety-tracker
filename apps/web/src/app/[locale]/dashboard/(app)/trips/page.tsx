import { formatTime } from '@sst/i18n';
import { todayInDubai, type Enums } from '@sst/shared';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ChangeHelperButton } from '@/components/dashboard/ChangeHelperButton';
import { Badge, statusBadgeColor } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient } from '@/lib/supabase/server';

type StudentStatus = Enums<'student_trip_status'>;

export default async function TripsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { date: dateParam } = await searchParams;
  const t = await getTranslations('dashboard.trips');
  const statusT = await getTranslations('status.trip');
  const { schoolId } = await requireAdmin(locale);
  const ar = locale === 'ar';

  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayInDubai(new Date());

  const supabase = await createClient();
  const [{ data: trips }, { data: helperMembers }] = await Promise.all([
    supabase
      .from('trips')
      .select(
        'id, direction, status, scheduled_departure, helper_id, bus:buses(label_ar, label_en), route:routes(name_ar, name_en), helper:profiles!trips_helper_id_fkey(display_name, phone), trip_students(status)',
      )
      .eq('school_id', schoolId)
      .eq('service_date', date)
      .order('scheduled_departure'),
    supabase
      .from('memberships')
      .select('user_id, profiles(display_name, phone)')
      .eq('school_id', schoolId)
      .eq('role', 'helper'),
  ]);

  const helpers = (helperMembers ?? []).map((m) => ({
    id: m.user_id,
    label: m.profiles?.display_name ?? m.profiles?.phone ?? m.user_id,
  }));
  const count = (rows: { status: StudentStatus }[], status: StudentStatus) =>
    rows.filter((r) => r.status === status).length;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <form className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('date')}
          <input
            type="date"
            name="date"
            defaultValue={date}
            dir="ltr"
            className="min-h-10 rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <button type="submit" className="min-h-10 rounded-lg border border-emerald-700 px-4 text-sm font-medium text-emerald-800">
          {t('show')}
        </button>
      </form>

      <Table
        rows={trips ?? []}
        rowKey={(trip) => trip.id}
        empty={t('empty')}
        columns={[
          { key: 'route', header: t('route'), render: (trip) => (ar ? trip.route?.name_ar : trip.route?.name_en) },
          {
            key: 'direction',
            header: t('direction'),
            render: (trip) => t(trip.direction === 'to_school' ? 'morning' : 'afternoon'),
          },
          { key: 'bus', header: t('bus'), render: (trip) => (ar ? trip.bus?.label_ar : trip.bus?.label_en) },
          {
            key: 'helper',
            header: t('helper'),
            render: (trip) => trip.helper?.display_name ?? trip.helper?.phone ?? t('noHelper'),
          },
          {
            key: 'status',
            header: t('status'),
            render: (trip) => <Badge color={statusBadgeColor(trip.status)}>{statusT(trip.status)}</Badge>,
          },
          {
            key: 'counts',
            header: `${t('boarded')} / ${t('missing')} / ${t('dropped')} / ${t('absent')}`,
            render: (trip) =>
              [
                count(trip.trip_students, 'boarded'),
                count(trip.trip_students, 'missing'),
                count(trip.trip_students, 'dropped'),
                count(trip.trip_students, 'absent_reported'),
              ].join(' / '),
          },
          {
            key: 'departure',
            header: t('departure'),
            render: (trip) => <span dir="ltr">{formatTime(trip.scheduled_departure, locale === 'ar' ? 'ar' : 'en')}</span>,
          },
          {
            key: 'actions',
            header: '',
            render: (trip) => (
              <div className="flex flex-wrap gap-1">
                <Link href={`/dashboard/trips/${trip.id}`} className="inline-flex min-h-10 items-center px-3 text-sm font-medium text-emerald-800 hover:underline">
                  {t('details')}
                </Link>
                <ChangeHelperButton tripId={trip.id} currentHelperId={trip.helper_id} helpers={helpers} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
