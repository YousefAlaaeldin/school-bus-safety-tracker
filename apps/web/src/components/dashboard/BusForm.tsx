'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

export type Bus = {
  id: string;
  label_en: string;
  label_ar: string;
  plate: string | null;
  capacity: number | null;
};

/** A button that opens a create/edit dialog. Pass `bus` to edit. */
export function BusForm({ schoolId, bus }: { schoolId: string; bus?: Bus }) {
  const t = useTranslations('dashboard.buses');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [labelEn, setLabelEn] = useState(bus?.label_en ?? '');
  const [labelAr, setLabelAr] = useState(bus?.label_ar ?? '');
  const [plate, setPlate] = useState(bus?.plate ?? '');
  const [capacity, setCapacity] = useState(bus?.capacity?.toString() ?? '');
  const [errors, setErrors] = useState<{ en?: string; ar?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors = {
      en: labelEn.trim() ? undefined : t('labelRequired'),
      ar: labelAr.trim() ? undefined : t('labelRequired'),
    };
    setErrors(nextErrors);
    if (nextErrors.en || nextErrors.ar) return;

    setLoading(true);
    setError(null);
    try {
      const values = {
        label_en: labelEn.trim(),
        label_ar: labelAr.trim(),
        plate: plate.trim() || null,
        capacity: capacity.trim() ? Number.parseInt(capacity, 10) : null,
      };
      const supabase = createClient();
      const { error: err } = bus
        ? await supabase.from('buses').update(values).eq('id', bus.id)
        : await supabase.from('buses').insert({ ...values, school_id: schoolId });
      if (err) {
        setError(errorsT('UNKNOWN'));
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError(errorsT('NETWORK'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant={bus ? 'ghost' : 'primary'} onClick={() => setOpen(true)}>
        {bus ? t('edit') : t('new')}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={bus ? t('edit') : t('new')}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input label={t('labelEn')} value={labelEn} onChange={(e) => setLabelEn(e.target.value)} dir="ltr" error={errors.en} />
          <Input label={t('labelAr')} value={labelAr} onChange={(e) => setLabelAr(e.target.value)} dir="rtl" error={errors.ar} />
          <Input label={t('plate')} value={plate} onChange={(e) => setPlate(e.target.value)} />
          <Input
            label={t('capacity')}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
          />
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

export function BusDeleteButton({ busId }: { busId: string }) {
  const t = useTranslations('dashboard.buses');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const remove = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await createClient().from('buses').delete().eq('id', busId);
      if (err) {
        // 23503 = foreign key violation: a route still uses this bus.
        setError(err.code === '23503' ? t('inUse') : errorsT('UNKNOWN'));
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError(errorsT('NETWORK'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>{t('delete')}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('delete')}>
        <p>{t('deleteConfirm')}</p>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <div className="flex gap-2">
          <Button variant="danger" loading={loading} onClick={() => void remove()}>{t('delete')}</Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>{t('cancel')}</Button>
        </div>
      </Dialog>
    </>
  );
}
