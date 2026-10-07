import { canTrackBus, journeyStatus } from '@sst/shared';
import { formatTime } from '@sst/i18n';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { getLanguage } from '@/i18n';
import { StudentPhoto } from '@/trip/StudentRow';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';
import { colors, spacing } from '@/ui/tokens';
import type { Child, Journey } from './useParentHome';

const TONE = { neutral: colors.muted, active: colors.primary, done: colors.success, danger: colors.danger } as const;

function JourneyLine({ label, journey }: { label: string; journey: Journey | null }) {
  const { t } = useTranslation();
  const locale = getLanguage();
  const status = journeyStatus(journey);
  const bus = journey?.bus ? (locale === 'ar' ? journey.bus.label_ar : journey.bus.label_en) : '';
  // Times keep their own left-to-right direction, with Western digits.
  const time = status.time ? `⁦${formatTime(status.time, locale)}⁩` : '';
  return (
    <View style={{ gap: spacing[1] }}>
      <Text variant="caption" style={{ color: colors.muted }}>{label}</Text>
      <Text variant="body" style={{ color: TONE[status.tone] }}>{t(`parent.status.${status.key}`, { time, bus })}</Text>
    </View>
  );
}

/** One child: photo, name, today's two journeys, and the Track / Report absence actions. */
export function ChildCard({ child }: { child: Child }) {
  const { t } = useTranslation();
  const router = useRouter();
  const name = getLanguage() === 'ar' ? child.name_ar : child.name_en;
  const trackable = [child.morning, child.afternoon].find((j) => j && canTrackBus(j));

  return (
    <Card style={{ gap: spacing[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
        <StudentPhoto student={child} size={56} />
        <Text variant="title" numberOfLines={2} style={{ flex: 1 }}>{name}</Text>
      </View>
      <JourneyLine label={t('parent.home.morning')} journey={child.morning} />
      <JourneyLine label={t('parent.home.afternoon')} journey={child.afternoon} />
      {trackable ? (
        <Button title={t('parent.home.track')} onPress={() => router.push(`/(parent)/track/${trackable.tripId}` as Href)} />
      ) : null}
      <Button
        title={t('parent.home.reportAbsence')}
        variant="secondary"
        onPress={() => router.push(`/(parent)/absence?studentId=${child.id}` as Href)}
      />
    </Card>
  );
}
