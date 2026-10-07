import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/** Shared layout for privacy, terms and support: draft banner, intro and titled sections. */
export async function LegalPage({
  locale,
  page,
  sections,
}: {
  locale: string;
  page: 'privacy' | 'terms' | 'support';
  sections: string[];
}) {
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('legal');

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-4">
        <Link href="/" className="text-sm text-emerald-800 hover:underline">
          {t('backHome')}
        </Link>
        <LocaleSwitch />
      </header>
      <p role="note" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">
        {t('draftNotice')}
      </p>
      <h1 className="mt-6 text-3xl font-bold">{t(`${page}.title`)}</h1>
      <p className="mt-2 text-sm text-neutral-500">{t('updated')}</p>
      <p className="mt-4 text-neutral-800">{t(`${page}.intro`)}</p>
      {sections.map((s) => (
        <section key={s} className="mt-8">
          <h2 className="text-xl font-bold">{t(`${page}.${s}.title`)}</h2>
          <p className="mt-2 text-neutral-800">{t(`${page}.${s}.body`)}</p>
        </section>
      ))}
    </div>
  );
}
