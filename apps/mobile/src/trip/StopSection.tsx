import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View, type LayoutChangeEvent } from 'react-native';
import { getLanguage } from '@/i18n';
import { Text } from '@/ui/Text';
import { colors, radius, spacing } from '@/ui/tokens';
import type { TripStop } from './useTrip';

type Props = {
  sequence: number;
  stop: TripStop | undefined;
  /** The next stop that still has work to do. */
  highlighted?: boolean;
  /** How many students are left at this stop. */
  left: number;
  /** A control in the header, such as "Drop all at this stop". */
  headerAction?: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
  children: ReactNode;
};

export function StopSection({ sequence, stop, highlighted, left, headerAction, onLayout, children }: Props) {
  const { t } = useTranslation();
  const ar = getLanguage() === 'ar';
  const label = stop ? (ar ? stop.label_ar : stop.label_en) : '';
  const details = [stop?.area, stop?.building, stop?.landmark_notes].filter(Boolean).join(' · ');

  return (
    <View
      onLayout={onLayout}
      style={{
        gap: spacing[2],
        padding: spacing[2],
        borderRadius: radius,
        borderWidth: highlighted ? 2 : 0,
        borderColor: colors.primary,
        backgroundColor: highlighted ? '#E8F3EE' : 'transparent',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: highlighted ? colors.primary : colors.muted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="caption" weight="bold" style={{ color: colors.onPrimary }}>{sequence}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="button" weight="bold">{label}</Text>
          {details ? <Text variant="caption" style={{ color: colors.muted }}>{details}</Text> : null}
        </View>
        <Text variant="caption" style={{ color: colors.muted }}>{t('helper.drop.left', { count: left })}</Text>
      </View>
      {headerAction}
      <View style={{ gap: spacing[2] }}>{children}</View>
    </View>
  );
}
