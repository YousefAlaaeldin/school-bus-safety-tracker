import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { SchoolSettingsForm } from '@/components/dashboard/SchoolSettingsForm';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient } from '@/lib/supabase/server';

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('dashboard.settings');
  const { schoolId } = await requireAdmin(locale);

  const supabase = await createClient();
  const { data: school } = await supabase
    .from('schools')
    .select(
      'name_ar, name_en, emirate, weekend_days, notify_parent_on_missing, eta_alert_minutes, absence_cutoff_minutes, location_retention_days, drop_distance_warning_m',
    )
    .eq('id', schoolId)
    .single();
  if (!school) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <SchoolSettingsForm schoolId={schoolId} school={school} />
    </div>
  );
}
