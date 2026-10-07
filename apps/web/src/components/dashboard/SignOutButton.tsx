'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations('dashboard.auth');
  const router = useRouter();

  return (
    <button
      type="button"
      className={className ?? 'rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100'}
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace('/dashboard/login');
        router.refresh();
      }}
    >
      {t('signOut')}
    </button>
  );
}
