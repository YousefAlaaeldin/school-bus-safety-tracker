import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { GuardiansPanel } from '@/components/dashboard/GuardiansPanel';
import { StudentForm } from '@/components/dashboard/StudentForm';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'student-photos';

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ locale: string; studentId: string }>;
}) {
  const { locale, studentId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('dashboard.students.form');
  const { schoolId } = await requireAdmin(locale);

  const supabase = await createClient();
  const { data: student } = await supabase
    .from('students')
    .select('id, name_en, name_ar, grade, active, photo_path')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (!student) notFound();

  let photoUrl: string | null = null;
  if (student.photo_path) {
    const objectPath = student.photo_path.startsWith(`${BUCKET}/`)
      ? student.photo_path.slice(BUCKET.length + 1)
      : student.photo_path;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(objectPath, 3600);
    photoUrl = data?.signedUrl ?? null;
  }

  const { data: links } = await supabase
    .from('guardian_links')
    .select('id, guardian_phone, guardian_user_id, relationship, status, can_track')
    .eq('student_id', studentId)
    .order('created_at');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('editTitle')}</h1>
      <StudentForm schoolId={schoolId} student={student} photoUrl={photoUrl} />
      <GuardiansPanel studentId={studentId} schoolId={schoolId} links={links ?? []} />
    </div>
  );
}
