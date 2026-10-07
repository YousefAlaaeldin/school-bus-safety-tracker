import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { StudentForm } from '@/components/dashboard/StudentForm';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export default async function NewStudentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('dashboard.students.form');
  const { schoolId } = await requireAdmin(locale);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t('newTitle')}</h1>
      <StudentForm schoolId={schoolId} />
    </div>
  );
}
