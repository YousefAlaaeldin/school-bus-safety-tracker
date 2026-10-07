import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

// Temporary page (T0.13). Replaced by the landing page in T1.51.
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('common');
  const other = locale === 'ar' ? 'en' : 'ar';

  return (
    <main className="p-8 text-start">
      <h1 className="text-2xl font-bold">{t('appName')}</h1>
      <Link href="/" locale={other} className="mt-4 inline-block underline">
        {t(other === 'ar' ? 'arabic' : 'english')}
      </Link>
    </main>
  );
}
