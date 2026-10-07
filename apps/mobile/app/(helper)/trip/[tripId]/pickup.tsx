import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';
import { rpcError } from '@/lib/supabase';
import { useHelperAction } from '@/queue/useHelperAction';
import { EndTripSheet, useEndTripRejection } from '@/trip/EndTripSheet';
import { StopSection } from '@/trip/StopSection';
import { StudentRow, studentName } from '@/trip/StudentRow';
import { useTrip } from '@/trip/useTrip';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Spinner } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { UndoSnackbar } from '@/ui/UndoSnackbar';
import { colors, spacing } from '@/ui/tokens';

type UndoState = { message: string; rpc: 'set_boarded' | 'undo_no_show'; studentId: string };

export default function PickupScreen() {
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trip, students, groups, counts, stops, loading, error, refetch } = useTrip(tripId);
  const run = useHelperAction();
  const router = useRouter();
  const [endOpen, setEndOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [arrived, setArrived] = useState(false);
  useEndTripRejection(tripId, useCallback(() => setEndOpen(true), []));
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [skipped, setSkipped] = useState(false);
  const dismissUndo = useCallback(() => setUndo(null), []);

  useEffect(() => {
    if (trip?.status === 'completed') router.replace('/(helper)');
  }, [trip?.status, router]);

  if (loading) return <Spinner />;
  if (error || !trip) {
    return (
      <Screen>
        <Banner kind="error" message={t(`errors.${rpcError(error)}`)} actionLabel={t('common.retry')} onAction={() => void refetch()} />
      </Screen>
    );
  }

  const nextStopId = groups?.find((g) => g.rows.some((r) => r.status === 'expected'))?.stop_id ?? null;
  const total = (students?.length ?? 0) - (counts?.absent_reported ?? 0);
  const nobodyLeft = nextStopId === null;

  const arrive = () =>
    Alert.alert(t('helper.pickup.arrived'), t('helper.pickup.arriveConfirm', { count: counts?.boarded ?? 0 }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('helper.pickup.confirm'),
        onPress: () => {
          setArrived(true);
          void run('arrive_at_school', { p_trip_id: tripId });
        },
      },
    ]);

  const endTrip = async (force: boolean, reason: string | null) => {
    setEnding(true);
    try {
      await run('end_trip', { p_trip_id: tripId, p_force: force, p_reason: reason });
      setEndOpen(false);
    } finally {
      setEnding(false);
    }
  };

  const pickUp = (studentId: string, name: string) => {
    void run('set_boarded', { p_trip_id: tripId, p_student_id: studentId, p_boarded: true });
    setUndo({ message: t('helper.pickup.pickedToast', { name }), rpc: 'set_boarded', studentId });
  };
  const noShow = (studentId: string, name: string) => {
    void run('mark_no_show', { p_trip_id: tripId, p_student_id: studentId });
    setUndo({ message: t('helper.pickup.noShowToast', { name }), rpc: 'undo_no_show', studentId });
  };
  const undoLast = () => {
    const current = undo;
    setUndo(null);
    if (!current) return;
    if (current.rpc === 'set_boarded') {
      void run('set_boarded', { p_trip_id: tripId, p_student_id: current.studentId, p_boarded: false });
    } else {
      void run('undo_no_show', { p_trip_id: tripId, p_student_id: current.studentId });
    }
  };

  return (
    <Screen>
      <View style={{ paddingVertical: spacing[3], gap: spacing[1] }}>
        <Text variant="title">{t('helper.pickup.title')}</Text>
        <Text variant="body" weight="medium" style={{ color: colors.primary }}>
          {t('helper.pickup.picked', { boarded: counts?.boarded ?? 0, total })}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ gap: spacing[3], paddingBottom: 120 }}>
        {groups?.map((group) => (
          <StopSection
            key={group.stop_id}
            sequence={group.stop_sequence}
            stop={stops?.[group.stop_id]}
            highlighted={group.stop_id === nextStopId}
            left={group.rows.filter((r) => r.status === 'expected').length}
          >
            {group.rows
              .filter((r) => r.status === 'expected' || r.status === 'boarded')
              .map((s) =>
                s.status === 'boarded' ? (
                  <StudentRow key={s.student_id} student={s} />
                ) : (
                  <StudentRow
                    key={s.student_id}
                    student={s}
                    indicator={<View />}
                    trailing={
                      <View style={{ gap: spacing[2] }}>
                        <Button title={t('helper.pickup.pickedUp')} onPress={() => pickUp(s.student_id, studentName(s))} />
                        <Button
                          title={t('helper.pickup.noShow')}
                          variant="secondary"
                          onPress={() => noShow(s.student_id, studentName(s))}
                        />
                      </View>
                    }
                  />
                ),
              )}
          </StopSection>
        ))}
      </ScrollView>
      {arrived || trip.arrived_school_at ? (
        <View style={{ paddingVertical: spacing[2] }}>
          <Button title={t('helper.drop.endTrip')} onPress={() => setEndOpen(true)} />
        </View>
      ) : nobodyLeft || skipped ? (
        <View style={{ paddingVertical: spacing[2] }}>
          <Button title={t('helper.pickup.arrived')} onPress={arrive} />
        </View>
      ) : (
        <View style={{ paddingVertical: spacing[2] }}>
          <Button title={t('helper.pickup.skipToSchool')} variant="secondary" onPress={() => setSkipped(true)} />
        </View>
      )}
      <EndTripSheet
        visible={endOpen}
        onBoard={(students ?? []).filter((s) => s.status === 'boarded')}
        loading={ending}
        onClose={() => setEndOpen(false)}
        onEnd={(force, reason) => void endTrip(force, reason)}
      />
      {undo ? <UndoSnackbar message={undo.message} onUndo={undoLast} onDismiss={dismissUndo} /> : null}
    </Screen>
  );
}
