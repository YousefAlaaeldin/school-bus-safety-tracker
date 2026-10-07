'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';

const ITEMS = [
  { key: 'live', href: '/dashboard' },
  { key: 'alerts', href: '/dashboard/alerts' },
  { key: 'trips', href: '/dashboard/trips' },
  { key: 'students', href: '/dashboard/students' },
  { key: 'import', href: '/dashboard/import' },
  { key: 'buses', href: '/dashboard/buses' },
  { key: 'stops', href: '/dashboard/stops' },
  { key: 'routes', href: '/dashboard/routes' },
  { key: 'staff', href: '/dashboard/staff' },
  { key: 'calendar', href: '/dashboard/calendar' },
  { key: 'settings', href: '/dashboard/settings' },
] as const;

/** A sidebar on the start side from 768px up; a top menu below that. */
export function Sidebar() {
  const t = useTranslations('dashboard.nav');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="border-b border-neutral-200 bg-white md:w-56 md:shrink-0 md:border-b-0 md:border-e">
      <button
        type="button"
        className="flex min-h-11 w-full items-center px-4 text-start font-medium md:hidden"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t('menu')}
      </button>
      <ul className={`${open ? 'flex' : 'hidden'} flex-col gap-1 p-2 md:flex`}>
        {ITEMS.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`block rounded-lg px-3 py-2 text-start ${
                isActive(item.href)
                  ? 'bg-emerald-100 font-semibold text-emerald-900'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              {t(item.key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
