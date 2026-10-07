import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { SignOutButton } from '@/components/dashboard/SignOutButton';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { schoolId } = await requireAdmin(locale);
  const supabase = await createClient();
  const { data: school } = await supabase
    .from('schools')
    .select('name_ar, name_en')
    .eq('id', schoolId)
    .single();
  const schoolName = locale === 'ar' ? school?.name_ar : school?.name_en;

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <span className="truncate text-lg font-bold text-emerald-800">{schoolName}</span>
        <div className="flex items-center gap-2">
          <LocaleSwitch />
          <SignOutButton />
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
