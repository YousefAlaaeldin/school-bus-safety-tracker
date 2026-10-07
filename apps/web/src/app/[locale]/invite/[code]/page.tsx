import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { StoreButtons } from '@/components/StoreButtons';
import { routing } from '@/i18n/routing';
import { OpenApp } from './OpenApp';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('landing.invite');
  const safeCode = decodeURIComponent(code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-4">
        <h1 className="text-2xl font-bold text-emerald-800">{t('title')}</h1>
        <LocaleSwitch />
      </header>
      <main className="mt-8">
        <OpenApp code={safeCode} storeButtons={<StoreButtons />} />
      </main>
    </div>
  );
}
