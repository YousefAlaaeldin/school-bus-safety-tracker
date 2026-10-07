import { useTranslation } from 'react-i18next';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function AdminHome() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Text variant="title">{t('admin.home.title')}</Text>
    </Screen>
  );
}
