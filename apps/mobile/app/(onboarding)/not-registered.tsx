import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useMyContext } from '@/auth/useMyContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { colors, spacing } from '@/ui/tokens';

export default function NotRegisteredScreen() {
  const { t } = useTranslation();
  const ctx = useMyContext(true);
  const phone = ctx.data?.profile.phone ?? ctx.data?.profile.email ?? '';

  return (
    <Screen scroll>
      <View style={{ gap: spacing[4], marginTop: spacing[6] }}>
        <Text variant="title">{t('onboarding.notRegistered.title')}</Text>
        <Text variant="body" style={{ color: colors.muted }}>{t('onboarding.notRegistered.help')}</Text>
        {phone ? (
          <Text variant="body" style={{ writingDirection: 'ltr' }}>
            {t('onboarding.notRegistered.yourNumber', { phone: `\u2066${phone}\u2069` })}
          </Text>
        ) : null}
        <Button title={t('common.signOut')} variant="secondary" onPress={() => void supabase.auth.signOut()} />
      </View>
    </Screen>
  );
}
