import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '@/i18n';

export default function Index() {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1, alignItems: 'stretch', justifyContent: 'center', padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 24, textAlign: 'auto' }}>{t('common.appName')}</Text>
      <Pressable onPress={() => void setLanguage('ar')}>
        <Text style={{ fontSize: 18, textAlign: 'auto' }}>{t('common.arabic')}</Text>
      </Pressable>
      <Pressable onPress={() => void setLanguage('en')}>
        <Text style={{ fontSize: 18, textAlign: 'auto' }}>{t('common.english')}</Text>
      </Pressable>
    </View>
  );
}
