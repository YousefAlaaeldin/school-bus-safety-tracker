import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/state/session';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { spacing } from '@/ui/tokens';

export default function ChooseRoleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setLastRole = useSession((s) => s.setLastRole);

  const pick = (role: 'parent' | 'helper') => {
    setLastRole(role);
    router.replace(role === 'parent' ? '/(parent)' : '/(helper)');
  };

  return (
    <Screen scroll>
      <View style={{ gap: spacing[4], marginTop: spacing[6] }}>
        <Text variant="title">{t('onboarding.chooseRole.title')}</Text>
        <Card onPress={() => pick('parent')} accessibilityLabel={t('onboarding.chooseRole.parent')}>
          <Text variant="button" weight="bold">{t('onboarding.chooseRole.parent')}</Text>
        </Card>
        <Card onPress={() => pick('helper')} accessibilityLabel={t('onboarding.chooseRole.helper')}>
          <Text variant="button" weight="bold">{t('onboarding.chooseRole.helper')}</Text>
        </Card>
        <Button title={t('common.signOut')} variant="secondary" onPress={() => void supabase.auth.signOut()} />
      </View>
    </Screen>
  );
}
