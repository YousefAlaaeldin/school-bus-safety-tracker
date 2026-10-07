import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { BusDeleteButton, BusForm } from '@/components/dashboard/BusForm';
import { Table } from '@/components/ui/Table';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient } from '@/lib/supabase/server';

export default async function BusesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('dashboard.buses');
  const { schoolId } = await requireAdmin(locale);

  const supabase = await createClient();
  const { data: buses } = await supabase
    .from('buses')
    .select('id, label_en, label_ar, plate, capacity')
    .eq('school_id', schoolId)
    .order('label_en');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <BusForm schoolId={schoolId} />
      </div>
      <Table
        rows={buses ?? []}
        rowKey={(b) => b.id}
        empty={t('empty')}
        columns={[
          { key: 'name', header: t('name'), render: (b) => (locale === 'ar' ? b.label_ar : b.label_en) },
          { key: 'plate', header: t('plate'), render: (b) => b.plate ?? '' },
          { key: 'capacity', header: t('capacity'), render: (b) => b.capacity ?? '' },
          {
            key: 'actions',
            header: '',
            render: (b) => (
              <div className="flex gap-1">
                <BusForm schoolId={schoolId} bus={b} />
                <BusDeleteButton busId={b.id} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
