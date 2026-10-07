import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CalendarDayDelete, CalendarDayForm } from '@/components/dashboard/CalendarDayForm';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient } from '@/lib/supabase/server';

export default async function CalendarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('dashboard.calendar');
  const { schoolId } = await requireAdmin(locale);

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: days }, { data: school }] = await Promise.all([
    supabase
      .from('school_calendar')
      .select('id, date, type, note, am_departure_override, pm_departure_override')
      .eq('school_id', schoolId)
      .gte('date', today)
      .order('date'),
    supabase.from('schools').select('weekend_days').eq('id', schoolId).single(),
  ]);

  const weekend = [...(school?.weekend_days ?? [])].sort((a, b) => a - b);
  const time = (v: string | null) => (v ? v.slice(0, 5) : '');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <CalendarDayForm schoolId={schoolId} />
      </div>

      <p className="text-sm text-neutral-700">
        <span className="font-medium">{t('weekend')}:</span>{' '}
        {weekend.map((d) => t(`days.${d}`)).join(' · ')}{' '}
        <span className="text-neutral-500">({t('weekendHelp')})</span>
      </p>

      <Table
        rows={days ?? []}
        rowKey={(d) => d.id}
        empty={t('empty')}
        columns={[
          { key: 'date', header: t('date'), render: (d) => <span dir="ltr">{d.date}</span> },
          { key: 'type', header: t('type'), render: (d) => <Badge color="blue">{t(`types.${d.type}`)}</Badge> },
          { key: 'note', header: t('note'), render: (d) => d.note ?? '' },
          { key: 'am', header: t('amOverride'), render: (d) => <span dir="ltr">{time(d.am_departure_override)}</span> },
          { key: 'pm', header: t('pmOverride'), render: (d) => <span dir="ltr">{time(d.pm_departure_override)}</span> },
          {
            key: 'actions',
            header: '',
            render: (d) => (
              <div className="flex gap-1">
                <CalendarDayForm schoolId={schoolId} day={d} />
                <CalendarDayDelete dayId={d.id} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
