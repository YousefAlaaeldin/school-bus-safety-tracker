import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, View } from 'react-native';
import { checkPermissions, ensurePermissions, type PermissionState } from '@/location/ensurePermissions';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { colors, spacing } from '@/ui/tokens';

/** Explains why location is needed and asks for it. Opened before a trip starts. */
export default function PermissionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [state, setState] = useState<PermissionState | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    void checkPermissions().then(setState);
  }, []);

  const allow = async () => {
    setAsking(true);
    try {
      setState(await ensurePermissions());
    } finally {
      setAsking(false);
    }
  };

  const canGoOn = state === 'ok' || state === 'needsBackground';

  return (
    <Screen scroll>
      <View style={{ gap: spacing[4], marginTop: spacing[6] }}>
        <Text variant="title">{t('permissions.location.title')}</Text>
        <Text variant="body" style={{ color: colors.muted }}>{t('permissions.location.why')}</Text>
        {Platform.OS === 'ios' ? (
          <Text variant="body" weight="medium">{t('permissions.location.iosAlways')}</Text>
        ) : null}

        {state === 'ok' ? <Banner kind="success" message={t('permissions.location.granted')} /> : null}
        {state === 'denied' ? <Banner kind="error" message={t('permissions.location.denied')} /> : null}
        {state === 'needsBackground' ? (
          <Banner kind="warning" message={t('permissions.location.foregroundOnly')} />
        ) : null}

        {state !== 'ok' ? (
          <Button title={t('permissions.location.allow')} onPress={() => void allow()} loading={asking} />
        ) : null}
        {state === 'denied' || state === 'needsBackground' ? (
          <Button
            title={t('permissions.location.openSettings')}
            variant="secondary"
            onPress={() => void Linking.openSettings()}
          />
        ) : null}
        {canGoOn ? (
          <Button
            title={state === 'ok' ? t('permissions.location.continue') : t('permissions.location.skip')}
            variant={state === 'ok' ? 'primary' : 'secondary'}
            onPress={() => router.back()}
          />
        ) : null}
      </View>
    </Screen>
  );
}
