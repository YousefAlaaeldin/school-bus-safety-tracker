import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { colors, radius, spacing } from '@/ui/tokens';
import { refreshQueueState, useQueueStore } from './runner';
import { sqliteStore } from './sqliteStore';

/**
 * Sync state for the helper: offline, N actions waiting, or a red dot when the server rejected
 * some actions (tap to read why and dismiss). Hidden when everything is synced.
 */
export function SyncBadge() {
  const { t } = useTranslation();
  const { pendingCount, failed, online } = useQueueStore();
  const [open, setOpen] = useState(false);

  const dismissAll = async () => {
    for (const a of failed) await sqliteStore.remove(a.id);
    await refreshQueueState();
    setOpen(false);
  };

  if (online && pendingCount === 0 && failed.length === 0) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        disabled={failed.length === 0}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[2],
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius,
          paddingHorizontal: spacing[3],
          minHeight: 36,
        }}
      >
        {!online ? <Text>☁️</Text> : null}
        {!online ? <Text variant="caption">{t('helper.sync.offline')}</Text> : null}
        {pendingCount > 0 ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        {pendingCount > 0 ? <Text variant="caption" weight="bold">{pendingCount}</Text> : null}
        {failed.length > 0 ? (
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger }} />
        ) : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing[5], backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius, padding: spacing[5], gap: spacing[3] }}>
            <Text variant="title">{t('helper.sync.failedTitle')}</Text>
            {failed.map((a) => (
              <View key={a.id}>
                <Text variant="body" weight="medium">{a.rpc}</Text>
                <Text variant="caption" style={{ color: colors.danger }}>
                  {t(`errors.${a.error ?? 'UNKNOWN'}`)}
                </Text>
              </View>
            ))}
            <Button title={t('helper.sync.dismiss')} onPress={() => void dismissAll()} />
            <Button title={t('helper.sync.close')} variant="secondary" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}
