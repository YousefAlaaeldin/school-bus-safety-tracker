import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { setSentryRole } from '@/lib/sentry';
import { useSession } from '@/state/session';
import { colors } from '@/ui/tokens';

export default function AdminLayout() {
  const { t } = useTranslation();
  const setLastRole = useSession((s) => s.setLastRole);
  useEffect(() => {
    setLastRole('admin');
    setSentryRole('admin');
  }, [setLastRole]);

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="index" options={{ title: t('admin.tabs.alerts') }} />
      <Tabs.Screen name="settings" options={{ title: t('admin.tabs.settings') }} />
    </Tabs>
  );
}
