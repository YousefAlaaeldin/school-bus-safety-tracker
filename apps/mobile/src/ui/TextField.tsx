import { TextInput, View, type TextInputProps } from 'react-native';
import { FONT_FAMILY } from './fonts';
import { Text } from './Text';
import { colors, radius, spacing } from './tokens';

type Props = Omit<TextInputProps, 'style'> & {
  label?: string;
  error?: string | null;
};

export function TextField({ label, error, ...input }: Props) {
  return (
    <View style={{ gap: spacing[2] }}>
      {label ? <Text variant="caption" style={{ color: colors.muted }}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...input}
        style={{
          minHeight: 52,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing[4],
          fontFamily: FONT_FAMILY.regular,
          fontSize: 16,
          color: colors.text,
          textAlign: 'auto',
        }}
      />
      {error ? <Text variant="caption" style={{ color: colors.danger }}>{error}</Text> : null}
    </View>
  );
}
