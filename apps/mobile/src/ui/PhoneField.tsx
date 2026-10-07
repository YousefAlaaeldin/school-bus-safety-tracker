import { isUaeMobile, normalizeUaePhone } from '@sst/shared';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { FONT_FAMILY } from './fonts';
import { Text } from './Text';
import { colors, radius, spacing } from './tokens';

type Props = {
  label?: string;
  error?: string | null;
  /** Called on every change with the E.164 number, or null while it is not a valid UAE mobile. */
  onChangeE164: (value: string | null) => void;
};

/** A fixed +971 prefix (always LTR) and a numeric input for the 9-digit mobile number. */
export function PhoneField({ label, error, onChangeE164 }: Props) {
  const [digits, setDigits] = useState('');

  const handleChange = (text: string) => {
    // Arabic-Indic (٠-٩) and Persian (۰-۹) digits from an Arabic keyboard become 0-9.
    const western = text.replace(/[٠-٩۰-۹]/g, (c) => String(c.charCodeAt(0) & 0xf));
    let d = western.replace(/\D/g, '');
    if (d.startsWith('00971')) d = d.slice(5);
    else if (d.startsWith('971')) d = d.slice(3);
    if (d.startsWith('0')) d = d.slice(1);
    d = d.slice(0, 9);
    setDigits(d);
    const e164 = d ? normalizeUaePhone(`+971${d}`) : null;
    onChangeE164(e164 && isUaeMobile(e164) ? e164 : null);
  };

  return (
    <View style={{ gap: spacing[2] }}>
      {label ? <Text variant="caption" style={{ color: colors.muted }}>{label}</Text> : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 52,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing[4],
          gap: spacing[2],
          // The number is always entered left-to-right, even in Arabic.
          direction: 'ltr',
        }}
      >
        <Text variant="body" style={{ writingDirection: 'ltr', color: colors.muted }}>
          +971
        </Text>
        <TextInput
          accessibilityLabel={label ?? '+971'}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={11}
          value={digits}
          onChangeText={handleChange}
          placeholder="5X XXX XXXX"
          placeholderTextColor={colors.muted}
          style={{
            flex: 1,
            fontFamily: FONT_FAMILY.regular,
            fontSize: 16,
            color: colors.text,
            writingDirection: 'ltr',
            textAlign: 'left',
          }}
        />
      </View>
      {error ? <Text variant="caption" style={{ color: colors.danger }}>{error}</Text> : null}
    </View>
  );
}
