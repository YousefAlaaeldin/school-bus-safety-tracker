import { ActivityIndicator, View } from 'react-native';
import { Button } from './Button';
import { Text } from './Text';
import { colors, spacing } from './tokens';

type Props = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: Props) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[5] }}>
      <Text variant="title" style={{ textAlign: 'center' }}>{title}</Text>
      {message ? (
        <Text variant="body" style={{ textAlign: 'center', color: colors.muted }}>{message}</Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

/** A centered ActivityIndicator for loading states. */
export function Spinner() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
