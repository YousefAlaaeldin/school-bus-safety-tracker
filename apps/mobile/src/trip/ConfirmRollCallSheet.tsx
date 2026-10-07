import type { StudentView } from '@sst/shared';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, View } from 'react-native';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { colors, radius, spacing } from '@/ui/tokens';
import { studentName } from './StudentRow';

type Props = {
  visible: boolean;
  /** Everyone still `expected`. */
  missing: StudentView[];
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Summary before roll call is sent: who will be reported missing. */
export function ConfirmRollCallSheet({ visible, missing, loading, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  const nobodyMissing = missing.length === 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopStartRadius: radius * 2,
            borderTopEndRadius: radius * 2,
            padding: spacing[5],
            gap: spacing[4],
            maxHeight: '80%',
          }}
        >
          <Text variant="title">
            {nobodyMissing ? t('helper.rollCall.sheet.allOnBoard') : t('helper.rollCall.sheet.missingTitle')}
          </Text>
          {!nobodyMissing ? (
            <>
              <ScrollView style={{ maxHeight: 240 }}>
                {missing.map((s) => (
                  <Text key={s.student_id} variant="body" style={{ paddingVertical: spacing[1] }}>
                    • {studentName(s)}
                  </Text>
                ))}
              </ScrollView>
              <Text variant="caption" style={{ color: colors.danger }}>
                {t('helper.rollCall.sheet.missingWarning')}
              </Text>
            </>
          ) : null}
          <View style={{ gap: spacing[3] }}>
            <Button
              testID="rollcall-sheet-confirm"
              title={nobodyMissing ? t('helper.rollCall.sheet.confirm') : t('helper.rollCall.sheet.confirmReport')}
              variant={nobodyMissing ? 'primary' : 'danger'}
              onPress={onConfirm}
              loading={loading}
            />
            <Button title={t('helper.rollCall.sheet.goBack')} variant="secondary" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
