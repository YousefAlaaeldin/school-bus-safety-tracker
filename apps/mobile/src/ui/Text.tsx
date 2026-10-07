import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { FONT_FAMILY, type FontWeight } from './fonts';

export type TextVariant = 'title' | 'body' | 'caption' | 'button';

const VARIANT_STYLE: Record<TextVariant, { fontSize: number; lineHeight: number; weight: FontWeight }> = {
  title: { fontSize: 24, lineHeight: 34, weight: 'bold' },
  body: { fontSize: 16, lineHeight: 24, weight: 'regular' },
  caption: { fontSize: 13, lineHeight: 18, weight: 'regular' },
  button: { fontSize: 16, lineHeight: 22, weight: 'medium' },
};

export type TextProps = RNTextProps & { variant?: TextVariant; weight?: FontWeight };

/** IBM Plex Sans Arabic is used for both languages (it includes Latin glyphs). */
export function Text({ variant = 'body', weight, style, ...rest }: TextProps) {
  const v = VARIANT_STYLE[variant];
  return (
    <RNText
      // Text scales with the system font size, up to 1.5x, so layouts stay intact.
      maxFontSizeMultiplier={1.5}
      {...rest}
      style={[
        {
          fontFamily: FONT_FAMILY[weight ?? v.weight],
          fontSize: v.fontSize,
          lineHeight: v.lineHeight,
          textAlign: 'auto',
        },
        style,
      ]}
    />
  );
}
