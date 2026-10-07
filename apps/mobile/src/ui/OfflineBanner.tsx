import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { colors, spacing } from './tokens';

/** A slim bar at the top of the screen while the phone has no connection. */
export function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // `isInternetReachable` is null until it has been checked; only a definite false counts.
    return NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false || state.isInternetReachable === false);
    });
  }, []);

  if (!offline) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: colors.warning,
        paddingTop: insets.top + spacing[1],
        paddingBottom: spacing[1],
        paddingHorizontal: spacing[4],
        alignItems: 'center',
      }}
    >
      <Text variant="caption" weight="bold" style={{ color: colors.onPrimary }}>
        {`⚠ ${t('common.offline')}`}
      </Text>
    </View>
  );
}
