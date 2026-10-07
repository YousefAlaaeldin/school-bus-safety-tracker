import { useTranslation } from 'react-i18next';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function ParentHome() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Text variant="title">{t('parent.home.title')}</Text>
    </Screen>
  );
}
