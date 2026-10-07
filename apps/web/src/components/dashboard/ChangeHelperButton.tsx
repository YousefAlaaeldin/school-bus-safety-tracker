'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

export type HelperOption = { id: string; label: string };

/** Assigns another helper to a trip through the set_trip_helper RPC. */
export function ChangeHelperButton({
  tripId,
  currentHelperId,
  helpers,
}: {
  tripId: string;
  currentHelperId: string | null;
  helpers: HelperOption[];
}) {
  const t = useTranslations('dashboard.trips');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [helperId, setHelperId] = useState(currentHelperId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!helperId) return;
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await createClient().rpc('set_trip_helper', {
        p_trip_id: tripId,
        p_helper_id: helperId,
      });
      if (err) {
        const known = ['NOT_AUTHORIZED', 'NOT_FOUND', 'INVALID_STATE', 'INVALID_INPUT'];
        setError(errorsT(known.includes(err.message) ? err.message : 'UNKNOWN'));
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
      <Button variant="ghost" onClick={() => setOpen(true)}>{t('changeHelper')}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('changeHelper')}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('chooseHelper')}
          <select
            value={helperId}
            onChange={(e) => setHelperId(e.target.value)}
            className="min-h-10 rounded-lg border border-neutral-300 px-3 py-2 text-base"
          >
            <option value="" disabled>{t('chooseHelper')}</option>
            {helpers.map((h) => (
              <option key={h.id} value={h.id}>{h.label}</option>
            ))}
          </select>
        </label>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <div className="flex gap-2">
          <Button loading={loading} disabled={!helperId} onClick={() => void save()}>{t('save')}</Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>{t('cancel')}</Button>
        </div>
      </Dialog>
    </>
  );
}
