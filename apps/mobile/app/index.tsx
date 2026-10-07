import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '@/i18n';
import { Text } from '@/ui/Text';

export default function Index() {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1, alignItems: 'stretch', justifyContent: 'center', padding: 24, gap: 16 }}>
      <Text variant="title">{t('common.appName')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.arabic')} onPress={() => void setLanguage('ar')}>
        <Text variant="button">{t('common.arabic')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.english')} onPress={() => void setLanguage('en')}>
        <Text variant="button">{t('common.english')}</Text>
      </Pressable>
    </View>
  );
}
