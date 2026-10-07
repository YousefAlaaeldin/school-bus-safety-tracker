import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { StoreButtons } from '@/components/StoreButtons';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

function RoleCard({
  title,
  benefits,
  children,
}: {
  title: string;
  benefits: string[];
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">{title}</h2>
      <ul className="flex flex-col gap-2 text-neutral-700">
        {benefits.map((b) => (
          <li key={b} className="flex gap-2">
            <span aria-hidden className="text-emerald-700">✓</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-3 pt-2">{children}</div>
    </section>
  );
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('landing');
  const common = await getTranslations('common');

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-4">
        <span className="text-xl font-bold text-emerald-800">{common('appName')}</span>
        <LocaleSwitch />
      </header>

      <main className="flex-1">
        <section className="py-10 text-start sm:py-16">
          <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-5xl">{t('headline')}</h1>
          <p className="mt-4 max-w-2xl text-lg text-neutral-700">{t('subline')}</p>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <RoleCard title={t('parents.title')} benefits={[t('parents.b1'), t('parents.b2'), t('parents.b3')]}>
            <StoreButtons />
          </RoleCard>
          <RoleCard title={t('helpers.title')} benefits={[t('helpers.b1'), t('helpers.b2'), t('helpers.b3')]}>
            <StoreButtons />
            <p className="text-sm text-neutral-600">{t('helpers.note')}</p>
          </RoleCard>
          <RoleCard title={t('schools.title')} benefits={[t('schools.b1'), t('schools.b2'), t('schools.b3')]}>
            <Link
              href="/dashboard/login"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800"
            >
              {t('schools.signIn')}
            </Link>
            <a
              href={`mailto:${t('demoEmail')}`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-emerald-700 px-4 py-2 font-medium text-emerald-800 hover:bg-emerald-50"
            >
              {t('schools.demo')}
            </a>
          </RoleCard>
        </div>

        <section className="py-12">
          <h2 className="text-2xl font-bold">{t('how.title')}</h2>
          <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(['s1', 's2', 's3', 's4'] as const).map((s, i) => (
              <li key={s} className="rounded-2xl bg-emerald-50 p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-emerald-700 font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-bold">{t(`how.${s}.title`)}</h3>
                <p className="mt-1 text-sm text-neutral-700">{t(`how.${s}.body`)}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="flex flex-wrap gap-x-6 gap-y-2 border-t border-neutral-200 py-6 text-sm text-neutral-600">
        <Link href="/privacy" className="hover:underline">{t('footer.privacy')}</Link>
        <Link href="/terms" className="hover:underline">{t('footer.terms')}</Link>
        <Link href="/support" className="hover:underline">{t('footer.support')}</Link>
      </footer>
    </div>
  );
}
