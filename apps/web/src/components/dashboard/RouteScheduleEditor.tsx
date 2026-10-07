'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

/** Seven rows (Sunday to Saturday): a checkbox and a departure time. Weekday 0 = Sunday. */
export function RouteScheduleEditor({
  routeId,
  initial,
}: {
  routeId: string;
  /** departure_time per weekday as 'HH:MM', for the days that run. */
  initial: Record<number, string>;
}) {
  const t = useTranslations('dashboard.route');
  const days = useTranslations('dashboard.calendar.days');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const [times, setTimes] = useState<Record<number, string>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const supabase = createClient();
      const on = Object.entries(times).filter(([, v]) => v);
      const offDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !times[d]);
      if (offDays.length > 0) {
        const { error: delErr } = await supabase.from('route_schedules').delete().eq('route_id', routeId).in('weekday', offDays);
        if (delErr) throw delErr;
      }
      if (on.length > 0) {
        const { error: upErr } = await supabase
          .from('route_schedules')
          .upsert(on.map(([d, v]) => ({ route_id: routeId, weekday: Number(d), departure_time: v })), { onConflict: 'route_id,weekday' });
        if (upErr) throw upErr;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(errorsT('UNKNOWN'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">{t('schedule')}</h2>
      <div className="flex max-w-md flex-col gap-2">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <div key={d} className="flex items-center gap-3">
            <label className="flex min-h-10 flex-1 items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4"
                checked={d in times && times[d] !== ''}
                onChange={(e) => {
                  setSaved(false);
                  setTimes((prev) => ({ ...prev, [d]: e.target.checked ? (prev[d] || '07:00') : '' }));
                }}
              />
              {days(String(d))}
            </label>
            <input
              type="time"
              dir="ltr"
              aria-label={`${days(String(d))} ${t('departure')}`}
              disabled={!times[d]}
              value={times[d] ?? ''}
              onChange={(e) => {
                setSaved(false);
                setTimes((prev) => ({ ...prev, [d]: e.target.value }));
              }}
              className="min-h-10 rounded-lg border border-neutral-300 px-3 py-2 disabled:opacity-40"
            />
          </div>
        ))}
      </div>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-800">{t('saved')}</p> : null}
      <div>
        <Button onClick={() => void save()} loading={loading}>{t('saveSchedule')}</Button>
      </div>
    </section>
  );
}
