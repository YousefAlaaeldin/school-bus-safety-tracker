'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

const EMIRATES = ['abu_dhabi', 'dubai', 'sharjah', 'ajman', 'umm_al_quwain', 'ras_al_khaimah', 'fujairah'] as const;

// Same bounds as the check constraints on public.schools.
const schema = z.object({
  name_ar: z.string().trim().min(1),
  name_en: z.string().trim().min(1),
  emirate: z.enum(EMIRATES),
  weekend_days: z.array(z.number().int().min(0).max(6)),
  notify_parent_on_missing: z.boolean(),
  eta_alert_minutes: z.number().int().min(1).max(60),
  absence_cutoff_minutes: z.number().int().min(0).max(720),
  location_retention_days: z.number().int().min(1).max(365),
  drop_distance_warning_m: z.number().int().min(0).max(100000),
});

export type SchoolSettings = {
  name_ar: string;
  name_en: string;
  emirate: string;
  weekend_days: number[];
  notify_parent_on_missing: boolean;
  eta_alert_minutes: number;
  absence_cutoff_minutes: number;
  location_retention_days: number;
  drop_distance_warning_m: number;
};

export function SchoolSettingsForm({ schoolId, school }: { schoolId: string; school: SchoolSettings }) {
  const t = useTranslations('dashboard.settings');
  const days = useTranslations('dashboard.calendar.days');
  const errorsT = useTranslations('errors');
  const router = useRouter();

  const [nameAr, setNameAr] = useState(school.name_ar);
  const [nameEn, setNameEn] = useState(school.name_en);
  const [emirate, setEmirate] = useState(school.emirate);
  const [weekend, setWeekend] = useState<number[]>(school.weekend_days);
  const [notify, setNotify] = useState(school.notify_parent_on_missing);
  const [eta, setEta] = useState(String(school.eta_alert_minutes));
  const [cutoff, setCutoff] = useState(String(school.absence_cutoff_minutes));
  const [retention, setRetention] = useState(String(school.location_retention_days));
  const [dropWarn, setDropWarn] = useState(String(school.drop_distance_warning_m));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const num = (v: string) => (v.trim() === '' ? Number.NaN : Number(v));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setError(null);

    const parsed = schema.safeParse({
      name_ar: nameAr,
      name_en: nameEn,
      emirate,
      weekend_days: weekend,
      notify_parent_on_missing: notify,
      eta_alert_minutes: num(eta),
      absence_cutoff_minutes: num(cutoff),
      location_retention_days: num(retention),
      drop_distance_warning_m: num(dropWarn),
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        next[key] = key.startsWith('name_') ? t('required') : t('range');
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});

    setLoading(true);
    try {
      const { error: err } = await createClient().from('schools').update(parsed.data).eq('id', schoolId);
      if (err) {
        setError(errorsT(err.message === 'NOT_AUTHORIZED' ? 'NOT_AUTHORIZED' : 'UNKNOWN'));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(errorsT('NETWORK'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6">
      <Input label={t('nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" error={fieldErrors.name_en} />
      <Input label={t('nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" error={fieldErrors.name_ar} />

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('emirate')}
        <select
          value={emirate}
          onChange={(e) => setEmirate(e.target.value)}
          className="min-h-10 rounded-lg border border-neutral-300 px-3 py-2 text-base"
        >
          {EMIRATES.map((x) => (
            <option key={x} value={x}>{t(`emirates.${x}`)}</option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t('weekend')}</legend>
        <div className="flex flex-wrap gap-3">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <label key={d} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={weekend.includes(d)}
                onChange={(e) => setWeekend((w) => (e.target.checked ? [...w, d].sort() : w.filter((x) => x !== d)))}
              />
              {days(String(d))}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" className="size-4" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        {t('notifyParentOnMissing')}
      </label>

      <Input label={t('etaAlertMinutes')} value={eta} onChange={(e) => setEta(e.target.value)} inputMode="numeric" dir="ltr" error={fieldErrors.eta_alert_minutes} />
      <Input label={t('absenceCutoffMinutes')} value={cutoff} onChange={(e) => setCutoff(e.target.value)} inputMode="numeric" dir="ltr" error={fieldErrors.absence_cutoff_minutes} />
      <Input label={t('locationRetentionDays')} value={retention} onChange={(e) => setRetention(e.target.value)} inputMode="numeric" dir="ltr" error={fieldErrors.location_retention_days} />
      <Input label={t('dropDistanceWarningM')} value={dropWarn} onChange={(e) => setDropWarn(e.target.value)} inputMode="numeric" dir="ltr" error={fieldErrors.drop_distance_warning_m} />

      {Object.keys(fieldErrors).length > 0 ? <p role="alert" className="text-sm text-red-700">{t('invalid')}</p> : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-800">{t('saved')}</p> : null}
      <div>
        <Button type="submit" loading={loading}>{t('save')}</Button>
      </div>
    </form>
  );
}
