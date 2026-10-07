import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rpcError } from '@/lib/supabase';
import { ChildCard } from '@/parent/ChildCard';
import { useParentHome } from '@/parent/useParentHome';
import { EmptyState, Spinner } from '@/ui/EmptyState';
import { Text } from '@/ui/Text';
import { colors, spacing } from '@/ui/tokens';

export default function ParentHome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const home = useParentHome();

  if (home.isLoading) return <Spinner />;
  if (home.error) {
    return (
      <EmptyState
        title={t(`errors.${rpcError(home.error)}`)}
        actionLabel={t('common.retry')}
        onAction={() => void home.refetch()}
      />
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing[4], paddingTop: insets.top + spacing[4], gap: spacing[4] }}
      refreshControl={<RefreshControl refreshing={home.isRefetching} onRefresh={() => void home.refetch()} />}
    >
      <Text variant="title">{t('parent.home.title')}</Text>
      {home.data?.length ? (
        home.data.map((c) => <ChildCard key={c.id} child={c} />)
      ) : (
        <Text variant="body" style={{ color: colors.muted }}>{t('parent.home.noChildren')}</Text>
      )}
    </ScrollView>
  );
}
