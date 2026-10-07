'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

export type Option = { id: string; label: string };

/** Creates a route: names, direction, bus, default helper and active flag. */
export function RouteForm({ schoolId, buses, helpers }: { schoolId: string; buses: Option[]; helpers: Option[] }) {
  const t = useTranslations('dashboard.routes');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [direction, setDirection] = useState<'to_school' | 'from_school'>('from_school');
  const [busId, setBusId] = useState('');
  const [helperId, setHelperId] = useState('');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!nameEn.trim()) next.en = t('nameRequired');
    if (!nameAr.trim()) next.ar = t('nameRequired');
    if (!busId) next.bus = t('busRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    setError(null);
    try {
      const { error: err } = await createClient().from('routes').insert({
        school_id: schoolId,
        name_en: nameEn.trim(),
        name_ar: nameAr.trim(),
        direction,
        bus_id: busId,
        default_helper_id: helperId || null,
        active,
      });
      if (err) {
        setError(errorsT('UNKNOWN'));
        return;
      }
      setOpen(false);
      setNameEn('');
      setNameAr('');
      router.refresh();
    } catch {
      setError(errorsT('NETWORK'));
    } finally {
      setLoading(false);
    }
  };

  const select = 'min-h-10 rounded-lg border border-neutral-300 px-3 py-2 text-base';

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={buses.length === 0} title={buses.length === 0 ? t('needBus') : undefined}>
        {t('new')}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('new')}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input label={t('nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" error={errors.en} />
          <Input label={t('nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" error={errors.ar} />
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('direction')}
            <select className={select} value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)}>
              <option value="to_school">{t('morning')}</option>
              <option value="from_school">{t('afternoon')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('bus')}
            <select className={select} value={busId} onChange={(e) => setBusId(e.target.value)}>
              <option value="" disabled>{t('bus')}</option>
              {buses.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
            {errors.bus ? <span className="text-sm text-red-700">{errors.bus}</span> : null}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('helper')}
            <select className={select} value={helperId} onChange={(e) => setHelperId(e.target.value)}>
              <option value="">{t('noHelper')}</option>
              {helpers.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="size-4" checked={active} onChange={(e) => setActive(e.target.checked)} />
            {t('active')}
          </label>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" loading={loading}>{t('save')}</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t('cancel')}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
