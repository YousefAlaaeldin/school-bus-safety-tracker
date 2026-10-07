'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

const BUCKET = 'student-photos';

const schema = z.object({
  name_en: z.string().trim().min(1),
  name_ar: z.string().trim().min(1),
  grade: z.string().trim(),
  active: z.boolean(),
});

export type StudentFormStudent = {
  id: string;
  name_en: string;
  name_ar: string;
  grade: string | null;
  active: boolean;
  photo_path: string | null;
};

type Props = {
  schoolId: string;
  student?: StudentFormStudent;
  /** A signed URL for the current photo. */
  photoUrl?: string | null;
};

export function StudentForm({ schoolId, student, photoUrl }: Props) {
  const t = useTranslations('dashboard.students.form');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const [nameEn, setNameEn] = useState(student?.name_en ?? '');
  const [nameAr, setNameAr] = useState(student?.name_ar ?? '');
  const [grade, setGrade] = useState(student?.grade ?? '');
  const [active, setActive] = useState(student?.active ?? true);
  const [photo, setPhoto] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name_en?: string; name_ar?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setError(null);

    const parsed = schema.safeParse({ name_en: nameEn, name_ar: nameAr, grade, active });
    if (!parsed.success) {
      const issues = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        name_en: issues.name_en ? t('nameRequired') : undefined,
        name_ar: issues.name_ar ? t('nameRequired') : undefined,
      });
      return;
    }
    setFieldErrors({});

    setLoading(true);
    const supabase = createClient();
    try {
      const values = {
        name_en: parsed.data.name_en,
        name_ar: parsed.data.name_ar,
        grade: parsed.data.grade || null,
        active: parsed.data.active,
      };

      let studentId = student?.id;
      if (studentId) {
        const { error: err } = await supabase.from('students').update(values).eq('id', studentId);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase
          .from('students')
          .insert({ ...values, school_id: schoolId })
          .select('id')
          .single();
        if (err) throw err;
        studentId = data.id;
      }

      if (photo && studentId) {
        const objectPath = `${schoolId}/${studentId}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(objectPath, photo, { upsert: true, contentType: photo.type || 'image/jpeg' });
        if (upErr) {
          setError(t('uploadFailed'));
          return;
        }
        const { error: pathErr } = await supabase
          .from('students')
          .update({ photo_path: `${BUCKET}/${objectPath}` })
          .eq('id', studentId);
        if (pathErr) throw pathErr;
      }

      setSaved(true);
      if (!student && studentId) router.replace(`/dashboard/students/${studentId}`);
      router.refresh();
    } catch {
      setError(errorsT('UNKNOWN'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6">
      <Input
        label={t('nameEn')}
        value={nameEn}
        onChange={(e) => setNameEn(e.target.value)}
        dir="ltr"
        error={fieldErrors.name_en}
      />
      <Input
        label={t('nameAr')}
        value={nameAr}
        onChange={(e) => setNameAr(e.target.value)}
        dir="rtl"
        error={fieldErrors.name_ar}
      />
      <Input label={t('grade')} value={grade} onChange={(e) => setGrade(e.target.value)} />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4" />
        {t('active')}
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t('photo')}</span>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="size-24 rounded-xl object-cover" />
        ) : null}
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          aria-label={t('photo')}
        />
        <p className="text-xs text-neutral-500">{t('photoHelp')}</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {saved ? <p className="text-sm text-emerald-800">{t('saved')}</p> : null}
      <div>
        <Button type="submit" loading={loading}>
          {t('save')}
        </Button>
      </div>
    </form>
  );
}
