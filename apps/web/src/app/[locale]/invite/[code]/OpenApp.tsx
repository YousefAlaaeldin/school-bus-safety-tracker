'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { APP } from '@sst/shared';

/** Tries to open the app through its URL scheme, then falls back to the code and store buttons. */
export function OpenApp({ code, storeButtons }: { code: string; storeButtons: ReactNode }) {
  const t = useTranslations('landing.invite');
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    // A custom URL scheme that opens the native app, not an internal Next.js page.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `${APP.scheme}://invite/${encodeURIComponent(code)}`;
    const id = setTimeout(() => setFallback(true), 1500);
    return () => clearTimeout(id);
  }, [code]);

  if (!fallback) return <p className="text-lg text-neutral-700">{t('opening')}</p>;

  return (
    <div className="flex flex-col items-start gap-5">
      <p className="text-neutral-700">{t('yourCode')}</p>
      <p dir="ltr" className="rounded-xl bg-neutral-100 px-6 py-4 font-mono text-4xl font-bold tracking-widest">
        {code}
      </p>
      <p className="text-lg font-medium">{t('install')}</p>
      {storeButtons}
    </div>
  );
}
