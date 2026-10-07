import { formatDate, formatTime } from '@sst/i18n';
import { addDays, journeyStatus, todayInDubai, type StudentTripStatus, type TripDirection, type TripStatus } from '@sst/shared';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLanguage } from '@/i18n';
import { rpcError, supabase } from '@/lib/supabase';
import { Card } from '@/ui/Card';
import { EmptyState, Spinner } from '@/ui/EmptyState';
import { Text } from '@/ui/Text';
import { colors, spacing } from '@/ui/tokens';

const DAYS = 14;

type Row = {
  key: string;
  date: string;
  student: { name_ar: string; name_en: string };
  direction: TripDirection;
  tripStatus: TripStatus;
  studentStatus: StudentTripStatus;
  scheduledDeparture: string;
  boardedAt: string | null;
  droppedAt: string | null;
  bus: { label_ar: string; label_en: string } | null;
};

async function loadHistory(): Promise<Row[]> {
  const from = addDays(todayInDubai(new Date()), -(DAYS - 1));
  const { data, error } = await supabase
    .from('trip_students')
    .select(
      'id, status, boarded_at, dropped_at, student:students(name_ar, name_en), trip:trips!inner(direction, status, scheduled_departure, service_date, bus:buses(label_ar, label_en))',
    )
    .gte('trip.service_date', from)
    .order('trip(service_date)', { ascending: false });
  if (error) throw error;
  return (data ?? []).flatMap((r) =>
    r.trip && r.student
      ? [
          {
            key: r.id,
            date: r.trip.service_date,
            student: r.student,
            direction: r.trip.direction as TripDirection,
            tripStatus: r.trip.status as TripStatus,
            studentStatus: r.status as StudentTripStatus,
            scheduledDeparture: r.trip.scheduled_departure,
            boardedAt: r.boarded_at,
            droppedAt: r.dropped_at,
            bus: r.trip.bus,
          },
        ]
      : [],
  );
}

const TONE = { neutral: colors.muted, active: colors.primary, done: colors.success, danger: colors.danger } as const;

export default function HistoryScreen() {
  const { t } = useTranslation();
  const locale = getLanguage();
  const insets = useSafeAreaInsets();
  const history = useQuery({ queryKey: ['parent-history'], queryFn: loadHistory });

  if (history.isLoading) return <Spinner />;
  if (history.error) {
    return (
      <EmptyState
        title={t(`errors.${rpcError(history.error)}`)}
        actionLabel={t('common.retry')}
        onAction={() => void history.refetch()}
      />
    );
  }

  // Group by date (newest first), keeping the order from the query.
  const byDate = new Map<string, Row[]>();
  for (const r of history.data ?? []) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
  const time = (iso: string) => `⁦${formatTime(iso, locale)}⁩`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing[4], paddingTop: insets.top + spacing[4], gap: spacing[4] }}
      refreshControl={<RefreshControl refreshing={history.isRefetching} onRefresh={() => void history.refetch()} />}
    >
      <Text variant="title">{t('parent.history.title')}</Text>
      {byDate.size === 0 ? <Text variant="body" style={{ color: colors.muted }}>{t('parent.history.empty')}</Text> : null}
      {[...byDate.entries()].map(([date, rows]) => (
        <View key={date} style={{ gap: spacing[2] }}>
          <Text variant="caption" style={{ color: colors.muted }}>{formatDate(date, locale)}</Text>
          {rows.map((r) => {
            const s = journeyStatus({
              direction: r.direction,
              tripStatus: r.tripStatus,
              studentStatus: r.studentStatus,
              scheduledDeparture: r.scheduledDeparture,
              boardedAt: r.boardedAt,
              droppedAt: r.droppedAt,
              etaAt: null,
            });
            const bus = r.bus ? (locale === 'ar' ? r.bus.label_ar : r.bus.label_en) : '';
            return (
              <Card key={r.key} style={{ gap: spacing[1] }}>
                <Text variant="body">{locale === 'ar' ? r.student.name_ar : r.student.name_en}</Text>
                <Text variant="caption" style={{ color: colors.muted }}>
                  {r.direction === 'to_school' ? t('parent.home.morning') : t('parent.home.afternoon')}
                </Text>
                <Text variant="body" style={{ color: TONE[s.tone] }}>
                  {t(`parent.status.${s.key}`, { time: s.time ? time(s.time) : '', bus })}
                </Text>
                {r.boardedAt ? (
                  <Text variant="caption" style={{ color: colors.muted }}>{t('parent.history.boardedAt', { time: time(r.boardedAt) })}</Text>
                ) : null}
                {r.droppedAt ? (
                  <Text variant="caption" style={{ color: colors.muted }}>{t('parent.history.droppedAt', { time: time(r.droppedAt) })}</Text>
                ) : null}
              </Card>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}
