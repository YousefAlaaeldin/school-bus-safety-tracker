import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { setSentryRole } from '@/lib/sentry';
import { useSession } from '@/state/session';
import { colors } from '@/ui/tokens';

export default function ParentLayout() {
  const { t } = useTranslation();
  const setLastRole = useSession((s) => s.setLastRole);
  useEffect(() => {
    setLastRole('parent');
    setSentryRole('parent');
  }, [setLastRole]);

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="index" options={{ title: t('parent.tabs.home') }} />
      <Tabs.Screen name="history" options={{ title: t('parent.tabs.history') }} />
      <Tabs.Screen name="settings" options={{ title: t('parent.tabs.settings') }} />
      {/* Screens above the tabs: no tab button. */}
      <Tabs.Screen name="track/[tripId]" options={{ href: null }} />
      <Tabs.Screen name="absence" options={{ href: null }} />
    </Tabs>
  );
}
