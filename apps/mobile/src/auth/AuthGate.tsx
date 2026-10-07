import { resolveDestination, type Destination } from '@sst/shared';
import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { useRootNavigationState, useRouter, useSegments, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { getLanguage } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/state/session';
import { Banner } from '@/ui/Banner';
import { Spinner } from '@/ui/EmptyState';
import { spacing } from '@/ui/tokens';
import { MY_CONTEXT_KEY, useMyContext } from './useMyContext';

const ROUTES: Record<Destination['kind'], Href> = {
  parentHome: '/(parent)',
  helperHome: '/(helper)',
  adminHome: '/(admin)',
  invite: '/(onboarding)/invite',
  pending: '/(onboarding)/pending',
  notRegistered: '/(onboarding)/not-registered',
  chooseRole: '/(onboarding)/choose-role',
};

/** The route group that each destination lives in. */
const GROUP: Record<Destination['kind'], string> = {
  parentHome: '(parent)',
  helperHome: '(helper)',
  adminHome: '(admin)',
  invite: '(onboarding)',
  pending: '(onboarding)',
  notRegistered: '(onboarding)',
  chooseRole: '(onboarding)',
};

export function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();
  const queryClient = useQueryClient();
  const intent = useSession((s) => s.intent);
  const lastRole = useSession((s) => s.lastRole);

  // undefined = still reading the stored session
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [mismatchRole, setMismatchRole] = useState<string | null>(null);
  const mismatchShown = useRef(false);
  const localeSynced = useRef(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        void queryClient.invalidateQueries({ queryKey: MY_CONTEXT_KEY });
      }
      if (event === 'SIGNED_OUT') {
        mismatchShown.current = false;
        localeSynced.current = false;
        queryClient.removeQueries({ queryKey: MY_CONTEXT_KEY });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  const ctxQuery = useMyContext(!!session);
  const ctx = ctxQuery.data;

  const navReady = !!navState?.key;
  const group = segments[0] as string | undefined;

  // Routing
  useEffect(() => {
    if (!navReady || session === undefined) return;

    if (!session) {
      if (group !== '(public)' && group !== 'invite') router.replace('/(public)/welcome');
      return;
    }
    if (!ctx) return;

    const { destination, mismatch } = resolveDestination(intent, ctx, lastRole);
    if (group !== GROUP[destination.kind]) router.replace(ROUTES[destination.kind]);

    if (mismatch && !mismatchShown.current) {
      mismatchShown.current = true;
      const role = destination.kind === 'parentHome' ? 'parent' : destination.kind === 'helperHome' ? 'helper' : 'admin';
      setMismatchRole(role);
    }
  }, [navReady, session, ctx, intent, lastRole, group, router]);

  // The device language wins over the stored profile language.
  useEffect(() => {
    if (!ctx || localeSynced.current) return;
    localeSynced.current = true;
    const appLanguage = getLanguage();
    if (ctx.profile.locale !== appLanguage) {
      void supabase.rpc('set_my_locale', { p_locale: appLanguage });
    }
  }, [ctx]);

  if (session === undefined) return <Spinner />;

  return (
    <View style={{ flex: 1 }}>
      {children}
      {mismatchRole ? (
        <View style={{ position: 'absolute', top: spacing[6] + spacing[5], start: spacing[4], end: spacing[4] }}>
          <Banner
            kind="info"
            message={t('onboarding.roleMismatch', { role: t(`onboarding.roles.${mismatchRole}`) })}
            actionLabel={t('common.ok')}
            onAction={() => setMismatchRole(null)}
          />
        </View>
      ) : null}
    </View>
  );
}
