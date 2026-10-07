import { availableRoles, type AppRole } from '@sst/shared';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useMyContext } from '@/auth/useMyContext';
import { getLanguage, setLanguage } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/state/session';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { colors, spacing } from '@/ui/tokens';

const HOME: Record<AppRole, Href> = {
  parent: '/(parent)',
  helper: '/(helper)',
  admin: '/(admin)',
};

function RadioRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
      </View>
      <Text variant="body">{label}</Text>
    </Pressable>
  );
}

export function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const ctx = useMyContext(true);
  const lastRole = useSession((s) => s.lastRole);
  const setLastRole = useSession((s) => s.setLastRole);
  const language = getLanguage();

  const roles = ctx.data ? availableRoles(ctx.data) : [];
  const otherRoles = roles.filter((r) => r !== lastRole);
  const identity = ctx.data?.profile.phone ?? ctx.data?.profile.email ?? '';

  const signOut = async () => {
    setLastRole(null);
    try {
      // unregister_push_token arrives with push registration (T3.08); ignore until it exists.
      await (supabase.rpc as unknown as (fn: string) => PromiseLike<unknown>)('unregister_push_token');
    } catch {
      // not available yet, or offline: signing out must still work
    }
    await supabase.auth.signOut();
  };

  return (
    <Screen scroll>
      <View style={{ gap: spacing[5], marginTop: spacing[4] }}>
        <Text variant="title">{t('settings.title')}</Text>

        <Card>
          <Text variant="caption" style={{ color: colors.muted }}>{t('settings.language')}</Text>
          <RadioRow label={t('common.arabic')} selected={language === 'ar'} onPress={() => void setLanguage('ar')} />
          <RadioRow label={t('common.english')} selected={language === 'en'} onPress={() => void setLanguage('en')} />
        </Card>

        {roles.length >= 2 ? (
          <Card>
            <Text variant="caption" style={{ color: colors.muted }}>{t('settings.switchRole')}</Text>
            {otherRoles.map((role) => (
              <Pressable
                key={role}
                accessibilityRole="button"
                onPress={() => {
                  setLastRole(role);
                  router.replace(HOME[role]);
                }}
                style={{ minHeight: 48, justifyContent: 'center' }}
              >
                <Text variant="button" style={{ color: colors.primary }}>{t(`settings.roles.${role}`)}</Text>
              </Pressable>
            ))}
          </Card>
        ) : null}

        {identity ? (
          <Card>
            <Text variant="caption" style={{ color: colors.muted }}>{t('settings.signedInAs')}</Text>
            <Text variant="body" style={{ writingDirection: 'ltr', textAlign: 'left' }}>{identity}</Text>
          </Card>
        ) : null}

        <Button title={t('common.signOut')} variant="secondary" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}
