'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const t = useTranslations('dashboard.auth');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        setError(/fetch|network/i.test(err.message) ? errors('NETWORK') : t('wrongCredentials'));
        return;
      }
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError(errors('NETWORK'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">{t('loginTitle')}</h1>
      <p className="text-neutral-600">{t('loginHelp')}</p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('email')}
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-base text-start"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('password')}
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-base text-start"
          />
        </label>
        {error ? (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="min-h-11 rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {t('signIn')}
        </button>
      </form>
    </main>
  );
}
