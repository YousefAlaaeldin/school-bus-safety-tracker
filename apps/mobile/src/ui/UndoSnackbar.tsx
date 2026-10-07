import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing } from './tokens';

type Props = {
  message: string;
  onUndo: () => void;
  /** Called when the snackbar goes away without an undo. */
  onDismiss: () => void;
  durationMs?: number;
};

/** A bar at the bottom with an Undo button. It disappears by itself after 10 s. */
export function UndoSnackbar({ message, onUndo, onDismiss, durationMs = 10_000 }: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    const id = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(id);
  }, [message, onDismiss, durationMs]);

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        start: spacing[4],
        end: spacing[4],
        bottom: spacing[4],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing[3],
        backgroundColor: colors.text,
        borderRadius: radius,
        paddingHorizontal: spacing[4],
        minHeight: 56,
      }}
    >
      <Text variant="body" style={{ color: colors.onPrimary, flex: 1 }}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('helper.drop.undo')}
        onPress={onUndo}
        style={{ minHeight: 48, minWidth: 64, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text variant="button" weight="bold" style={{ color: '#9BE3C3' }}>{t('helper.drop.undo')}</Text>
      </Pressable>
    </View>
  );
}
