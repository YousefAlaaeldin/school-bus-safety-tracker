import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { spacing } from '@/ui/tokens';

export default function AdminHome() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen>
      <View style={{ gap: spacing[4] }}>
        <Text variant="title">{t('admin.home.title')}</Text>
        <Button title={t('settings.title')} variant="secondary" onPress={() => router.push('/(admin)/settings')} />
      </View>
    </Screen>
  );
}
