'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Table } from '@/components/ui/Table';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

export type Assignment = {
  id: string;
  studentId: string;
  studentName: string;
  stopId: string;
  stopLabel: string;
  weekdays: number[];
  validFrom: string;
};
export type PickOption = { id: string; label: string };

const DEFAULT_DAYS = [1, 2, 3, 4, 5];

/** Assigned students with stop and weekday chips, plus add/edit/remove. */
export function RouteAssignments({
  routeId,
  assignments,
  students,
  routeStops,
}: {
  routeId: string;
  assignments: Assignment[];
  /** Students of the school who are not yet on this route (plus the one being edited). */
  students: PickOption[];
  /** Only the stops of this route. */
  routeStops: PickOption[];
}) {
  const t = useTranslations('dashboard.route');
  const days = useTranslations('dashboard.calendar.days');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const locale = useLocale();
  const [editing, setEditing] = useState<Assignment | 'new' | null>(null);
  const [removing, setRemoving] = useState<Assignment | null>(null);
  const [studentId, setStudentId] = useState('');
  const [stopId, setStopId] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>(DEFAULT_DAYS);
  const [validFrom, setValidFrom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = (a: Assignment | 'new') => {
    setEditing(a);
    setError(null);
    if (a === 'new') {
      setStudentId('');
      setStopId('');
      setWeekdays(DEFAULT_DAYS);
      setValidFrom(new Date().toISOString().slice(0, 10));
    } else {
      setStudentId(a.studentId);
      setStopId(a.stopId);
      setWeekdays(a.weekdays);
      setValidFrom(a.validFrom);
    }
  };

  const mapError = (err: { code?: string; message: string }) => {
    // The trigger raises INVALID_INPUT when the stop is not on this route.
    if (err.message.includes('INVALID_INPUT')) return t('stopNotOnRoute');
    if (err.code === '23505') return t('alreadyAssigned');
    return errorsT('UNKNOWN');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!studentId || !stopId || weekdays.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const values = { stop_id: stopId, weekdays, valid_from: validFrom || new Date().toISOString().slice(0, 10) };
      const { error: err } =
        editing && editing !== 'new'
          ? await supabase.from('student_assignments').update(values).eq('id', editing.id)
          : await supabase.from('student_assignments').insert({ ...values, student_id: studentId, route_id: routeId });
      if (err) {
        setError(mapError(err));
        return;
      }
      setEditing(null);
      router.refresh();
    } catch {
      setError(errorsT('NETWORK'));
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await createClient().from('student_assignments').delete().eq('id', removing.id);
      if (err) {
        setError(errorsT('UNKNOWN'));
        return;
      }
      setRemoving(null);
      router.refresh();
    } catch {
      setError(errorsT('NETWORK'));
    } finally {
      setLoading(false);
    }
  };

  const select = 'min-h-10 rounded-lg border border-neutral-300 px-3 py-2 text-base';

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t('assignments')}</h2>
        <Button onClick={() => open('new')} disabled={students.length === assignments.length || routeStops.length === 0}>
          {t('assign')}
        </Button>
      </div>

      <Table
        rows={assignments}
        rowKey={(a) => a.id}
        empty={t('noAssignments')}
        columns={[
          { key: 'student', header: t('student'), render: (a) => a.studentName },
          { key: 'stop', header: t('stop'), render: (a) => a.stopLabel },
          {
            key: 'days',
            header: t('weekdays'),
            render: (a) => (
              <span className="flex flex-wrap gap-1">
                {[...a.weekdays].sort().map((d) => (
                  <span key={d} className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">
                    {days(String(d))}
                  </span>
                ))}
              </span>
            ),
          },
          { key: 'from', header: t('validFrom'), render: (a) => <span dir="ltr">{a.validFrom}</span> },
          {
            key: 'actions',
            header: '',
            render: (a) => (
              <div className="flex gap-1">
                <Button variant="ghost" onClick={() => open(a)}>{t('edit')}</Button>
                <Button variant="ghost" onClick={() => { setRemoving(a); setError(null); }}>{t('deleteAssignment')}</Button>
              </div>
            ),
          },
        ]}
      />

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={t('assign')}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('student')}
            <select className={select} value={studentId} disabled={editing !== 'new'} onChange={(e) => setStudentId(e.target.value)}>
              <option value="" disabled>{t('chooseStudent')}</option>
              {students
                .filter((s) => editing !== 'new' || !assignments.some((a) => a.studentId === s.id))
                .map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('stop')}
            <select className={select} value={stopId} onChange={(e) => setStopId(e.target.value)}>
              <option value="" disabled>{t('chooseStop')}</option>
              {routeStops.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{t('weekdays')}</legend>
            <div className="flex flex-wrap gap-3">
              {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                <label key={d} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={weekdays.includes(d)}
                    onChange={(e) => setWeekdays((w) => (e.target.checked ? [...w, d].sort() : w.filter((x) => x !== d)))}
                  />
                  {days(String(d))}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('validFrom')}
            <input type="date" dir="ltr" lang={locale} className={select} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </label>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" loading={loading} disabled={!studentId || !stopId || weekdays.length === 0}>{t('save')}</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>{t('cancel')}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={removing !== null} onClose={() => setRemoving(null)} title={t('deleteAssignment')}>
        <p>{t('confirmRemove')}</p>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <div className="flex gap-2">
          <Button variant="danger" loading={loading} onClick={() => void remove()}>{t('deleteAssignment')}</Button>
          <Button variant="ghost" onClick={() => setRemoving(null)}>{t('cancel')}</Button>
        </div>
      </Dialog>
    </section>
  );
}
