import { useTranslations } from 'next-intl';

const linkClass =
  'inline-flex min-h-11 items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700';

/** App Store / Google Play buttons. URLs come from env and stay "#" until the app is published. */
export function StoreButtons() {
  const t = useTranslations('landing.store');
  return (
    <div className="flex flex-wrap gap-2">
      <a href={process.env.NEXT_PUBLIC_APP_STORE_URL ?? '#'} className={linkClass}>
        {t('apple')}
      </a>
      <a href={process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? '#'} className={linkClass}>
        {t('google')}
      </a>
    </div>
  );
}
