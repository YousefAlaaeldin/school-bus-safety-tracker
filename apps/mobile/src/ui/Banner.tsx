import { View } from 'react-native';
import { Button } from './Button';
import { Text } from './Text';
import { colors, radius, spacing } from './tokens';

export type BannerKind = 'error' | 'warning' | 'info' | 'success';

const TINT: Record<BannerKind, string> = {
  error: colors.danger,
  warning: colors.warning,
  info: colors.primary,
  success: colors.success,
};

type Props = {
  kind: BannerKind;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function Banner({ kind, message, actionLabel, onAction }: Props) {
  const tint = TINT[kind];
  return (
    <View
      accessibilityRole="alert"
      style={{
        borderRadius: radius,
        borderWidth: 1,
        borderColor: tint,
        borderStartWidth: 6,
        backgroundColor: colors.surface,
        padding: spacing[4],
        gap: spacing[3],
      }}
    >
      <Text variant="body">{message}</Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="secondary" />
      ) : null}
    </View>
  );
}
