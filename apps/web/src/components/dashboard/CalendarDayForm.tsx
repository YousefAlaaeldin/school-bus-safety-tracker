'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

const TYPES = ['holiday', 'closure', 'early_dismissal', 'ramadan_hours'] as const;
type DayType = (typeof TYPES)[number];

export type CalendarDay = {
  id: string;
  date: string;
  type: DayType;
  note: string | null;
  am_departure_override: string | null;
  pm_departure_override: string | null;
};

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');

/** Add (no `day`) or edit a calendar day. Override times show only for early dismissal / Ramadan hours. */
export function CalendarDayForm({ schoolId, day }: { schoolId: string; day?: CalendarDay }) {
  const t = useTranslations('dashboard.calendar');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(day?.date ?? '');
  const [type, setType] = useState<DayType>(day?.type ?? 'holiday');
  const [note, setNote] = useState(day?.note ?? '');
  const [am, setAm] = useState(hhmm(day?.am_departure_override ?? null));
  const [pm, setPm] = useState(hhmm(day?.pm_departure_override ?? null));
  const [dateError, setDateError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const showOverrides = type === 'early_dismissal' || type === 'ramadan_hours';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date) {
      setDateError(t('dateRequired'));
      return;
    }
    setDateError(null);
    setError(null);
    setLoading(true);
    try {
      const values = {
        date,
        type,
        note: note.trim() || null,
        am_departure_override: showOverrides && am ? am : null,
        pm_departure_override: showOverrides && pm ? pm : null,
      };
      const supabase = createClient();
      const { error: err } = day
        ? await supabase.from('school_calendar').update(values).eq('id', day.id)
        : await supabase.from('school_calendar').insert({ ...values, school_id: schoolId });
      if (err) {
        // 23505 = unique violation on (school_id, date)
        setError(err.code === '23505' ? t('duplicate') : errorsT('UNKNOWN'));
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
      <Button variant={day ? 'ghost' : 'primary'} onClick={() => setOpen(true)}>
        {day ? t('edit') : t('add')}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={day ? t('edit') : t('add')}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input label={t('date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} error={dateError} dir="ltr" />
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('type')}
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DayType)}
              className="min-h-10 rounded-lg border border-neutral-300 px-3 py-2 text-base"
            >
              {TYPES.map((x) => (
                <option key={x} value={x}>{t(`types.${x}`)}</option>
              ))}
            </select>
          </label>
          <Input label={t('note')} value={note} onChange={(e) => setNote(e.target.value)} />
          {showOverrides ? (
            <>
              <Input label={t('amOverride')} type="time" value={am} onChange={(e) => setAm(e.target.value)} dir="ltr" />
              <Input label={t('pmOverride')} type="time" value={pm} onChange={(e) => setPm(e.target.value)} dir="ltr" />
            </>
          ) : null}
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

export function CalendarDayDelete({ dayId }: { dayId: string }) {
  const t = useTranslations('dashboard.calendar');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const remove = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await createClient().from('school_calendar').delete().eq('id', dayId);
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
