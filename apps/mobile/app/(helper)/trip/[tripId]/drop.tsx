import { formatTime } from '@sst/i18n';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { getLanguage } from '@/i18n';
import { rpcError } from '@/lib/supabase';
import { useHelperAction } from '@/queue/useHelperAction';
import { StopSection } from '@/trip/StopSection';
import { StudentRow, studentName } from '@/trip/StudentRow';
import { useDropAction } from '@/trip/useDropAction';
import { useTrip } from '@/trip/useTrip';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Spinner } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { UndoSnackbar } from '@/ui/UndoSnackbar';
import { colors, spacing } from '@/ui/tokens';

export default function DropScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = getLanguage();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trip, students, groups, counts, stops, dropDistanceWarningM, loading, error, refetch } = useTrip(tripId);
  const run = useHelperAction();
  const dropStudents = useDropAction(tripId, dropDistanceWarningM ?? 200);
  const [undo, setUndo] = useState<{ message: string; studentIds: string[] } | null>(null);
  const dismissUndo = useCallback(() => setUndo(null), []);
  const scrollRef = useRef<ScrollView>(null);
  const layouts = useRef<Record<string, number>>({});
  const scrolledTo = useRef<string | null>(null);

  const nextStopId = groups?.find((g) => g.rows.some((r) => r.status === 'boarded'))?.stop_id ?? null;

  // Bring the next stop into view when it changes.
  useEffect(() => {
    if (!nextStopId || scrolledTo.current === nextStopId) return;
    const y = layouts.current[nextStopId];
    if (y !== undefined) {
      scrolledTo.current = nextStopId;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing[3]), animated: true });
    }
  }, [nextStopId, groups]);

  const dropAt = async (rows: { student_id: string; name: string }[], stopId: string) => {
    const ok = await dropStudents(rows, stops?.[stopId]);
    if (ok) {
      setUndo({
        message: t('helper.drop.droppedToast', {
          name: rows.length === 1 ? (rows[0]?.name ?? '') : String(rows.length),
        }),
        studentIds: rows.map((r) => r.student_id),
      });
    }
  };

  const undoLast = () => {
    const current = undo;
    setUndo(null);
    if (!current) return;
    for (const id of current.studentIds) void run('undo_dropped', { p_trip_id: tripId, p_student_id: id });
  };

  if (loading) return <Spinner />;
  if (error || !trip) {
    return (
      <Screen>
        <Banner kind="error" message={t(`errors.${rpcError(error)}`)} actionLabel={t('common.retry')} onAction={() => void refetch()} />
      </Screen>
    );
  }

  const missing = (students ?? []).filter((s) => s.status === 'missing');

  return (
    <Screen>
      <View style={{ paddingVertical: spacing[3], gap: spacing[1] }}>
        <Text variant="title">{t('helper.drop.title')}</Text>
        <Text variant="body" weight="medium" style={{ color: colors.primary }}>
          {t('helper.drop.onBoard', { count: counts?.boarded ?? 0 })}
        </Text>
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={{ gap: spacing[3], paddingBottom: spacing[6] }}>
        {missing.length > 0 ? (
          <View style={{ gap: spacing[2] }}>
            <Text variant="button" weight="bold" style={{ color: colors.danger }}>{t('helper.drop.missingSection')}</Text>
            {missing.map((s) => (
              <StudentRow
                key={s.student_id}
                student={s}
                indicator={<Text variant="caption" style={{ color: colors.danger }}>{t('helper.drop.missingBadge')}</Text>}
              />
            ))}
          </View>
        ) : null}

        {groups?.map((group) => {
          const left = group.rows.filter((r) => r.status === 'boarded').length;
          return (
            <StopSection
              key={group.stop_id}
              sequence={group.stop_sequence}
              stop={stops?.[group.stop_id]}
              highlighted={group.stop_id === nextStopId}
              left={left}
              headerAction={
                left > 1 ? (
                  <Button
                    title={t('helper.drop.dropAll')}
                    variant="secondary"
                    onPress={() =>
                      void dropAt(
                        group.rows
                          .filter((r) => r.status === 'boarded')
                          .map((r) => ({ student_id: r.student_id, name: studentName(r) })),
                        group.stop_id,
                      )
                    }
                  />
                ) : undefined
              }
              onLayout={(e) => {
                layouts.current[group.stop_id] = e.nativeEvent.layout.y;
              }}
            >
              {group.rows
                .filter((r) => r.status === 'boarded' || r.status === 'dropped')
                .map((s) =>
                  s.status === 'dropped' ? (
                    <StudentRow
                      key={s.student_id}
                      student={s}
                      struck
                      indicator={
                        <Text variant="caption" style={{ color: colors.muted }}>
                          {s.dropped_at ? t('helper.drop.droppedAt', { time: formatTime(s.dropped_at, locale) }) : ''}
                        </Text>
                      }
                    />
                  ) : (
                    <StudentRow
                      key={s.student_id}
                      student={s}
                      indicator={<View />}
                      trailing={<Button title={t('helper.drop.dropped')} onPress={() => void dropAt([{ student_id: s.student_id, name: studentName(s) }], group.stop_id)} />}
                    />
                  ),
                )}
            </StopSection>
          );
        })}
      </ScrollView>
      <View style={{ paddingVertical: spacing[2] }}>
        <Button title={t('helper.drop.map')} variant="secondary" onPress={() => router.push(`/(helper)/trip/${tripId}/map`)} />
      </View>
      {undo ? <UndoSnackbar message={undo.message} onUndo={undoLast} onDismiss={dismissUndo} /> : null}
    </Screen>
  );
}
