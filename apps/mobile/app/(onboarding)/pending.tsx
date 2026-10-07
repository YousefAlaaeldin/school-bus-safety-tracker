import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useMyContext } from '@/auth/useMyContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { colors, spacing } from '@/ui/tokens';

export default function PendingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const ctx = useMyContext(true);

  return (
    <Screen scroll>
      <View style={{ gap: spacing[4], marginTop: spacing[6] }}>
        <Text variant="title">{t('onboarding.pending.title')}</Text>
        <Text variant="body" style={{ color: colors.muted }}>{t('onboarding.pending.help')}</Text>
        <Button title={t('onboarding.pending.haveCode')} onPress={() => router.push('/(onboarding)/invite')} />
        <Button
          title={t('onboarding.pending.checkAgain')}
          variant="secondary"
          loading={ctx.isFetching}
          onPress={() => void ctx.refetch()}
        />
        <Button title={t('common.signOut')} variant="secondary" onPress={() => void supabase.auth.signOut()} />
      </View>
    </Screen>
  );
}
