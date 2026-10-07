import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from './tokens';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

type Props = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const BG: Record<ButtonVariant, string> = {
  primary: colors.primary,
  secondary: colors.surface,
  danger: colors.danger,
};
const FG: Record<ButtonVariant, string> = {
  primary: colors.onPrimary,
  secondary: colors.primary,
  danger: colors.onPrimary,
};

/** Min height 56: a big touch target for helpers on a moving bus. */
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 56,
          borderRadius: radius,
          paddingHorizontal: spacing[5],
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          backgroundColor: BG[variant],
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: colors.primary,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={FG[variant]} />
      ) : (
        <Text variant="button" style={{ color: FG[variant] }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
