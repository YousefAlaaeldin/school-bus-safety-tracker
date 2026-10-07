import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { i18next, initI18n } from '@/i18n';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

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

  if (!ready) return null;

  return (
    <I18nextProvider i18n={i18next}>
      <Stack screenOptions={{ headerShown: false }} />
    </I18nextProvider>
  );
}
