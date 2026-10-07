import '../src/location/backgroundTask';
import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { initI18n } from '@/i18n';
import { AuthGate } from '@/auth/AuthGate';
import { AppProviders } from '@/providers/AppProviders';
import { initSentry, wrap } from '@/lib/sentry';
import { fontAssets } from '@/ui/fonts';

initSentry();

function RootLayout() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    let cancelled = false;
    initI18n().then(({ reloading }) => {
      // When the layout direction changed the app reloads; keep showing nothing until then.
      if (!cancelled && !reloading) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || (!fontsLoaded && !fontError)) return null;

  return (
    <AppProviders>
      <AuthGate>
        <Slot />
      </AuthGate>
    </AppProviders>
  );
}

export default wrap(RootLayout);
