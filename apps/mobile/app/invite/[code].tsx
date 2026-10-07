import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/state/session';
import { Spinner } from '@/ui/EmptyState';

/** Deep link: saferide://invite/ABCD2345. Stores the code, then goes to sign-in or the invite screen. */
export default function InviteDeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const setPendingInviteCode = useSession((s) => s.setPendingInviteCode);
  const setIntent = useSession((s) => s.setIntent);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const normalized = String(code ?? '').toUpperCase();
    setPendingInviteCode(normalized || null);
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setIntent('parent');
      setSignedIn(!!data.session);
    });
  }, [code, setIntent, setPendingInviteCode]);

  if (signedIn === null) return <Spinner />;
  const normalized = String(code ?? '').toUpperCase();
  return signedIn ? (
    <Redirect href={{ pathname: '/(onboarding)/invite', params: { code: normalized } }} />
  ) : (
    <Redirect href={{ pathname: '/(public)/phone', params: { intent: 'parent' } }} />
  );
}
