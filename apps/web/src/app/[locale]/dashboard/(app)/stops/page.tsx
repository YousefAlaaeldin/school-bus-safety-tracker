import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { StopDeleteButton, StopForm, type Stop } from '@/components/dashboard/StopForm';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient } from '@/lib/supabase/server';

export default async function StopsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('dashboard.stops');
  const { schoolId } = await requireAdmin(locale);
  const ar = locale === 'ar';

  const supabase = await createClient();
  const { data } = await supabase
    .from('stops_with_coords')
    .select('id, label_en, label_ar, area, building, makani_number, landmark_notes, is_school, lat, lng')
    .eq('school_id', schoolId)
    .order('label_en');

  const stops: Stop[] = (data ?? []).flatMap((s) =>
    s.id && s.lat != null && s.lng != null
      ? [{
          id: s.id,
          label_en: s.label_en ?? '',
          label_ar: s.label_ar ?? '',
          area: s.area,
          building: s.building,
          makani_number: s.makani_number,
          landmark_notes: s.landmark_notes,
          is_school: s.is_school ?? false,
          lat: s.lat,
          lng: s.lng,
        }]
      : [],
  );
  const school = stops.find((s) => s.is_school);
  const schoolPoint = school ? { lat: school.lat, lng: school.lng } : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <StopForm schoolId={schoolId} schoolPoint={schoolPoint} />
      </div>
      <Table
        rows={stops}
        rowKey={(s) => s.id}
        empty={t('empty')}
        columns={[
          {
            key: 'name',
            header: t('name'),
            render: (s) => (
              <span className="flex items-center gap-2">
                {ar ? s.label_ar : s.label_en}
                {s.is_school ? <Badge color="green">{t('school')}</Badge> : null}
              </span>
            ),
          },
          { key: 'area', header: t('area'), render: (s) => s.area ?? '' },
          { key: 'building', header: t('building'), render: (s) => s.building ?? '' },
          {
            key: 'actions',
            header: '',
            render: (s) => (
              <div className="flex gap-1">
                <StopForm schoolId={schoolId} stop={s} schoolPoint={schoolPoint} />
                <StopDeleteButton stopId={s.id} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
