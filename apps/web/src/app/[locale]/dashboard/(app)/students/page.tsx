import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient } from '@/lib/supabase/server';

export default async function StudentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { q } = await searchParams;
  const t = await getTranslations('dashboard.students');
  const { schoolId } = await requireAdmin(locale);

  const supabase = await createClient();
  let query = supabase
    .from('students')
    .select('id, name_ar, name_en, grade, active, guardian_links(status)')
    .eq('school_id', schoolId)
    .order('name_en');
  // Strip characters that have a meaning in PostgREST filter syntax.
  const term = (q ?? '').replace(/[,()%*\\]/g, ' ').trim();
  if (term) query = query.or(`name_en.ilike.%${term}%,name_ar.ilike.%${term}%`);
  const { data: students } = await query;

  const rows = students ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link
          href="/dashboard/students/new"
          className="inline-flex min-h-10 items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          {t('new')}
        </Link>
      </div>

      <form className="flex gap-2" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder={t('searchPlaceholder')}
          aria-label={t('search')}
          className="min-h-10 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-start"
        />
        <button type="submit" className="min-h-10 rounded-lg border border-emerald-700 px-4 text-sm font-medium text-emerald-800">
          {t('search')}
        </button>
      </form>

      <Table
        rows={rows}
        rowKey={(s) => s.id}
        empty={t('empty')}
        columns={[
          { key: 'name', header: t('name'), render: (s) => (locale === 'ar' ? s.name_ar : s.name_en) },
          { key: 'grade', header: t('grade'), render: (s) => s.grade ?? '' },
          {
            key: 'guardians',
            header: t('guardians'),
            render: (s) =>
              t('guardiansCount', {
                total: s.guardian_links.length,
                pending: s.guardian_links.filter((g) => g.status === 'pending').length,
              }),
          },
          {
            key: 'status',
            header: t('status'),
            render: (s) => (
              <Badge color={s.active ? 'green' : 'gray'}>{s.active ? t('active') : t('inactive')}</Badge>
            ),
          },
          {
            key: 'edit',
            header: '',
            render: (s) => (
              <Link href={`/dashboard/students/${s.id}`} className="font-medium text-emerald-800 hover:underline">
                {t('edit')}
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
