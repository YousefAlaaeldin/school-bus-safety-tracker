import type { StudentView } from '@sst/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, View } from 'react-native';
import { refreshQueueState, useQueueStore } from '@/queue/runner';
import { sqliteStore } from '@/queue/sqliteStore';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { colors, radius, spacing } from '@/ui/tokens';
import { studentName } from './StudentRow';

type Props = {
  visible: boolean;
  /** Students still `boarded`. */
  onBoard: StudentView[];
  loading?: boolean;
  onClose: () => void;
  /** `reason` is set only for a forced end. */
  onEnd: (force: boolean, reason: string | null) => void;
};

/**
 * End-trip confirmation. With nobody on board it is a plain confirm. Otherwise it lists who is
 * still on the bus and offers "End anyway", which needs a reason.
 */
export function EndTripSheet({ visible, onBoard, loading, onClose, onEnd }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const hasOnBoard = onBoard.length > 0;

  useEffect(() => {
    if (!visible) setReason('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopStartRadius: radius * 2,
            borderTopEndRadius: radius * 2,
            padding: spacing[5],
            gap: spacing[4],
            maxHeight: '85%',
          }}
        >
          <Text variant="title">{t(hasOnBoard ? 'helper.endTrip.onBoardTitle' : 'helper.endTrip.confirm')}</Text>
          {hasOnBoard ? (
            <>
              <ScrollView style={{ maxHeight: 200 }}>
                {onBoard.map((s) => (
                  <Text key={s.student_id} variant="body" style={{ paddingVertical: spacing[1] }}>
                    • {studentName(s)}
                  </Text>
                ))}
              </ScrollView>
              <Text variant="caption" style={{ color: colors.danger }}>{t('helper.endTrip.onBoardWarning')}</Text>
              <TextField label={t('helper.endTrip.reason')} value={reason} onChangeText={setReason} />
            </>
          ) : null}
          <View style={{ gap: spacing[3] }}>
            {hasOnBoard ? (
              <Button
                testID="end-trip-anyway"
                title={t('helper.endTrip.endAnyway')}
                variant="danger"
                disabled={reason.trim().length === 0}
                loading={loading}
                onPress={() => onEnd(true, reason.trim())}
              />
            ) : (
              <Button testID="end-trip-confirm" title={t('helper.endTrip.confirmButton')} loading={loading} onPress={() => onEnd(false, null)} />
            )}
            <Button title={t('helper.endTrip.cancel')} variant="secondary" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * If the server rejects a queued end_trip with STUDENTS_ON_BOARD, the failed action is removed
 * from the queue and `onRejected` is called so the screen can reopen the sheet.
 */
export function useEndTripRejection(tripId: string, onRejected: () => void) {
  const failed = useQueueStore((s) => s.failed);
  useEffect(() => {
    const rejected = failed.filter(
      (a) => a.rpc === 'end_trip' && a.args.p_trip_id === tripId && a.error === 'STUDENTS_ON_BOARD',
    );
    if (rejected.length === 0) return;
    void (async () => {
      for (const a of rejected) await sqliteStore.remove(a.id);
      await refreshQueueState();
      onRejected();
    })();
  }, [failed, tripId, onRejected]);
}
