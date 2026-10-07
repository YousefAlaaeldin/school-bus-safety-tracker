import type { StudentTripStatus } from '@sst/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { useHelperAction } from '@/queue/useHelperAction';
import { ConfirmRollCallSheet } from '@/trip/ConfirmRollCallSheet';
import { StudentRow, studentName } from '@/trip/StudentRow';
import { useTrip } from '@/trip/useTrip';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Spinner } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { rpcError } from '@/lib/supabase';
import { colors, spacing } from '@/ui/tokens';

const ORDER: Record<StudentTripStatus, number> = {
  expected: 0,
  missing: 1,
  boarded: 2,
  absent_reported: 3,
  dropped: 4,
  returned_to_school: 5,
};

export default function RollCallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trip, students, counts, loading, error, refetch } = useTrip(tripId);
  const run = useHelperAction();
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Once roll call is confirmed (or the trip is not in roll call), the router picks the next screen.
  useEffect(() => {
    if (trip && trip.status !== 'roll_call') router.replace(`/(helper)/trip/${tripId}`);
  }, [trip, tripId, router]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (students ?? [])
      .filter((s) => !q || studentName(s).toLowerCase().includes(q))
      .sort((a, b) => ORDER[a.status] - ORDER[b.status] || studentName(a).localeCompare(studentName(b)));
  }, [students, query]);

  if (loading) return <Spinner />;
  if (error || !trip) {
    return (
      <Screen>
        <Banner kind="error" message={t(`errors.${rpcError(error)}`)} actionLabel={t('common.retry')} onAction={() => void refetch()} />
      </Screen>
    );
  }

  const total = (students?.length ?? 0) - (counts?.absent_reported ?? 0);

  const toggle = (studentId: string, boarded: boolean) =>
    void run('set_boarded', { p_trip_id: tripId, p_student_id: studentId, p_boarded: !boarded });

  const confirm = async () => {
    setConfirming(true);
    try {
      await run('confirm_roll_call', { p_trip_id: tripId });
      setSheetOpen(false);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: spacing[3], paddingVertical: spacing[3] }}>
        <Text variant="title">{t('helper.rollCall.title')}</Text>
        <Text variant="body" weight="medium" style={{ color: colors.primary }}>
          {t('helper.rollCall.onBoard', { boarded: counts?.boarded ?? 0, total })}
        </Text>
        <TextField value={query} onChangeText={setQuery} placeholder={t('helper.rollCall.search')} autoCorrect={false} />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(s) => s.student_id}
        contentContainerStyle={{ gap: spacing[2], paddingBottom: spacing[6] }}
        ListEmptyComponent={<Text variant="body" style={{ color: colors.muted }}>{t('helper.rollCall.noResults')}</Text>}
        renderItem={({ item }) => (
          <StudentRow student={item} onPress={() => toggle(item.student_id, item.status === 'boarded')} />
        )}
      />
      <View style={{ paddingVertical: spacing[3] }}>
        <Button testID="rollcall-confirm" title={t('helper.rollCall.confirmButton')} onPress={() => setSheetOpen(true)} />
      </View>
      <ConfirmRollCallSheet
        visible={sheetOpen}
        missing={(students ?? []).filter((s) => s.status === 'expected')}
        loading={confirming}
        onCancel={() => setSheetOpen(false)}
        onConfirm={() => void confirm()}
      />
    </Screen>
  );
}
