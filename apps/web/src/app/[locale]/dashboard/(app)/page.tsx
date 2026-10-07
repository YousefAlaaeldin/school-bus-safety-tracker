import { todayInDubai } from '@sst/shared';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LiveBoard, type LivePosition, type LiveTrip } from '@/components/dashboard/LiveBoard';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient } from '@/lib/supabase/server';

export default async function LiveBoardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('dashboard.live');
  const { schoolId } = await requireAdmin(locale);
  const ar = locale === 'ar';

  const supabase = await createClient();
  const { data: trips } = await supabase
    .from('trips')
    .select('id, status, bus:buses(label_ar, label_en), route:routes(name_ar, name_en), trip_students(status)')
    .eq('school_id', schoolId)
    .eq('service_date', todayInDubai(new Date()))
    .in('status', ['roll_call', 'in_progress'])
    .order('scheduled_departure');

  const tripIds = (trips ?? []).map((x) => x.id);
  const [{ data: positions }, { data: alerts }] = tripIds.length
    ? await Promise.all([
        supabase.from('bus_positions').select('trip_id, lat, lng, recorded_at').in('trip_id', tripIds),
        supabase.from('alerts').select('trip_id').in('trip_id', tripIds).is('acknowledged_at', null),
      ])
    : [{ data: [] as LivePosition[] }, { data: [] as { trip_id: string | null }[] }];

  const live: LiveTrip[] = (trips ?? []).map((trip) => {
    const count = (s: string) => trip.trip_students.filter((r) => r.status === s).length;
    return {
      id: trip.id,
      status: trip.status,
      busLabel: (ar ? trip.bus?.label_ar : trip.bus?.label_en) ?? '',
      routeName: (ar ? trip.route?.name_ar : trip.route?.name_en) ?? '',
      boarded: count('boarded'),
      missing: count('missing'),
      dropped: count('dropped'),
      openAlerts: (alerts ?? []).filter((a) => a.trip_id === trip.id).length,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <LiveBoard schoolId={schoolId} trips={live} positions={positions ?? []} />
    </div>
  );
}
