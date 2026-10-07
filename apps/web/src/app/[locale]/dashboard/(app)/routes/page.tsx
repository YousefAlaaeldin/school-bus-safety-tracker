import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { RouteForm } from '@/components/dashboard/RouteForm';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient } from '@/lib/supabase/server';

export default async function RoutesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('dashboard.routes');
  const { schoolId } = await requireAdmin(locale);
  const ar = locale === 'ar';

  const supabase = await createClient();
  const [{ data: routes }, { data: buses }, { data: helperMembers }] = await Promise.all([
    supabase
      .from('routes')
      .select('id, name_ar, name_en, direction, active, bus:buses(label_ar, label_en), helper:profiles!routes_default_helper_id_fkey(display_name, phone)')
      .eq('school_id', schoolId)
      .order('name_en'),
    supabase.from('buses').select('id, label_ar, label_en').eq('school_id', schoolId).order('label_en'),
    supabase.from('memberships').select('user_id, profiles(display_name, phone)').eq('school_id', schoolId).eq('role', 'helper'),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <RouteForm
          schoolId={schoolId}
          buses={(buses ?? []).map((b) => ({ id: b.id, label: ar ? b.label_ar : b.label_en }))}
          helpers={(helperMembers ?? []).map((m) => ({ id: m.user_id, label: m.profiles?.display_name ?? m.profiles?.phone ?? m.user_id }))}
        />
      </div>
      <Table
        rows={routes ?? []}
        rowKey={(r) => r.id}
        empty={t('empty')}
        columns={[
          { key: 'name', header: t('name'), render: (r) => (ar ? r.name_ar : r.name_en) },
          {
            key: 'direction',
            header: t('direction'),
            render: (r) => <Badge color={r.direction === 'to_school' ? 'blue' : 'amber'}>{t(r.direction === 'to_school' ? 'morning' : 'afternoon')}</Badge>,
          },
          { key: 'bus', header: t('bus'), render: (r) => (ar ? r.bus?.label_ar : r.bus?.label_en) },
          { key: 'helper', header: t('helper'), render: (r) => r.helper?.display_name ?? r.helper?.phone ?? t('noHelper') },
          {
            key: 'active',
            header: t('active'),
            render: (r) => <Badge color={r.active ? 'green' : 'gray'}>{r.active ? t('active') : t('inactive')}</Badge>,
          },
          {
            key: 'open',
            header: '',
            render: (r) => (
              <Link href={`/dashboard/routes/${r.id}`} className="font-medium text-emerald-800 hover:underline">
                {t('open')}
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
