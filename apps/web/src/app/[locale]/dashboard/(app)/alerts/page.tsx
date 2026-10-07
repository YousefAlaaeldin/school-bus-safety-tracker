import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AlertsList, type AlertItem } from '@/components/dashboard/AlertsList';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient } from '@/lib/supabase/server';

export default async function AlertsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { show } = await searchParams;
  const t = await getTranslations('dashboard.alerts');
  const { schoolId } = await requireAdmin(locale);
  const all = show === 'all';
  const ar = locale === 'ar';

  const supabase = await createClient();
  let query = supabase
    .from('alerts')
    .select('id, type, severity, trip_id, payload, created_at, acknowledged_at')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (!all) query = query.is('acknowledged_at', null);
  const { data: rows } = await query;

  // Resolve student names mentioned in the payloads.
  const studentIds = new Set<string>();
  for (const r of rows ?? []) {
    const p = (r.payload ?? {}) as { student_ids?: string[]; student_id?: string };
    for (const id of p.student_ids ?? []) studentIds.add(id);
    if (p.student_id) studentIds.add(p.student_id);
  }
  const { data: students } = studentIds.size
    ? await supabase.from('students').select('id, name_ar, name_en').in('id', [...studentIds])
    : { data: [] };
  const nameOf = new Map((students ?? []).map((s) => [s.id, ar ? s.name_ar : s.name_en]));

  const alerts: AlertItem[] = (rows ?? []).map((r) => {
    const p = (r.payload ?? {}) as { student_ids?: string[]; student_id?: string; reason?: string };
    const ids = [...(p.student_ids ?? []), ...(p.student_id ? [p.student_id] : [])];
    return {
      id: r.id,
      type: r.type,
      severity: r.severity,
      trip_id: r.trip_id,
      created_at: r.created_at,
      acknowledged_at: r.acknowledged_at,
      studentNames: ids.map((id) => nameOf.get(id)).filter((n): n is string => !!n),
      reason: p.reason ?? null,
    };
  });

  const tab = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium ${active ? 'bg-emerald-700 text-white' : 'border border-neutral-300 text-neutral-700'}`;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <div className="flex gap-2">
        <Link href="/dashboard/alerts" className={tab(!all)}>{t('filterOpen')}</Link>
        <Link href="/dashboard/alerts?show=all" className={tab(all)}>{t('filterAll')}</Link>
      </div>
      <AlertsList schoolId={schoolId} alerts={alerts} />
    </div>
  );
}
