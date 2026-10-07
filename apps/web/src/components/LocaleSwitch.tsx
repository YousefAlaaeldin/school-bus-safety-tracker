'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

/** Links to the same path in the other locale. */
export function LocaleSwitch() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('common');
  const other = locale === 'ar' ? 'en' : 'ar';

  return (
    <Link
      href={pathname}
      locale={other}
      lang={other}
      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
    >
      {t(other === 'ar' ? 'arabic' : 'english')}
    </Link>
  );
}
