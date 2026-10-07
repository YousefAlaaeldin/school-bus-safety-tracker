import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { SignOutButton } from '@/components/dashboard/SignOutButton';
import { routing } from '@/i18n/routing';

export default async function NoAccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('dashboard.auth');

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">{t('noAccessTitle')}</h1>
      <p className="text-neutral-700">{t('noAccessBody')}</p>
      <div>
        <SignOutButton />
      </div>
    </main>
  );
}
