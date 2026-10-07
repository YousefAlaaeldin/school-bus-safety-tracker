'use client';

import { formatTime } from '@sst/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Badge, type BadgeColor } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Link, useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

export type AlertItem = {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  trip_id: string | null;
  created_at: string;
  acknowledged_at: string | null;
  studentNames: string[];
  reason: string | null;
};

const SEVERITY_COLOR: Record<AlertItem['severity'], BadgeColor> = {
  info: 'blue',
  warning: 'amber',
  critical: 'red',
};

/** A short beep for critical alerts, made with the Web Audio API (no audio file needed). */
function beep() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Browsers may block audio before the first user interaction.
  }
}

export function AlertsList({ schoolId, alerts }: { schoolId: string; alerts: AlertItem[] }) {
  const t = useTranslations('dashboard.alerts');
  const errorsT = useTranslations('errors');
  const locale = useLocale() === 'ar' ? 'ar' : 'en';
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New alerts appear live; critical ones also play a sound.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`alerts-${schoolId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts', filter: `school_id=eq.${schoolId}` },
        (payload) => {
          if ((payload.new as { severity?: string }).severity === 'critical') beep();
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [schoolId, router]);

  const acknowledge = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const { error: err } = await createClient().rpc('acknowledge_alert', { p_alert_id: id });
      if (err) {
        setError(errorsT('UNKNOWN'));
        return;
      }
      router.refresh();
    } catch {
      setError(errorsT('NETWORK'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {alerts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-600">
          {t('empty')}
        </p>
      ) : null}
      {alerts.map((a) => (
        <article key={a.id} className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={SEVERITY_COLOR[a.severity]}>{t(`severity.${a.severity}`)}</Badge>
            <h2 className="font-semibold">{t(a.type)}</h2>
            <span dir="ltr" className="ms-auto text-sm text-neutral-500">{formatTime(a.created_at, locale)}</span>
          </div>
          {a.studentNames.length > 0 ? (
            <p className="text-sm text-neutral-800">{t('students', { names: a.studentNames.join(locale === 'ar' ? '، ' : ', ') })}</p>
          ) : null}
          {a.reason ? <p className="text-sm text-neutral-800">{t('reason', { reason: a.reason })}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            {a.trip_id ? (
              <Link href={`/dashboard/trips/${a.trip_id}`} className="text-sm font-medium text-emerald-800 hover:underline">
                {t('trip')}
              </Link>
            ) : null}
            {a.acknowledged_at ? (
              <span className="text-sm text-neutral-500">{t('acknowledged')}</span>
            ) : (
              <Button variant="secondary" loading={busy === a.id} onClick={() => void acknowledge(a.id)}>
                {t('acknowledge')}
              </Button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
