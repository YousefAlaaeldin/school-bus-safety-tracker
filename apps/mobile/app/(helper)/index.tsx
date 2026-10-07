import { todayInDubai } from '@sst/shared';
import { formatTime } from '@sst/i18n';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useMyContext } from '@/auth/useMyContext';
import { getLanguage } from '@/i18n';
import { rpcError, supabase } from '@/lib/supabase';
import { Banner } from '@/ui/Banner';
import { Card } from '@/ui/Card';
import { EmptyState, Spinner } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { colors, radius, spacing } from '@/ui/tokens';

const STATUS_COLOR: Record<string, string> = {
  scheduled: colors.muted,
  roll_call: colors.warning,
  in_progress: colors.primary,
  completed: colors.success,
  cancelled: colors.muted,
};

export default function HelperHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = getLanguage();
  const ctx = useMyContext(true);
  const uid = ctx.data?.profile.id;

  const trips = useQuery({
    queryKey: ['helper-trips', uid, todayInDubai(new Date())],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(
          'id, direction, status, scheduled_departure, bus:buses(label_ar, label_en), route:routes(name_ar, name_en), trip_students(status)',
        )
        .eq('helper_id', uid as string)
        .eq('service_date', todayInDubai(new Date()))
        .order('scheduled_departure');
      if (error) throw error;
      return data;
    },
  });

  return (
    <Screen scroll testID="helper-home">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[3] }}>
        <Text variant="title">{t('helper.home.title')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('helper.home.settings')}
          onPress={() => router.push('/(helper)/settings')}
          style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 24 }}>⚙️</Text>
        </Pressable>
      </View>

      <View style={{ gap: spacing[3], marginTop: spacing[4] }}>
        {trips.isLoading || ctx.isLoading ? <Spinner /> : null}
        {trips.error ? (
          <Banner
            kind="error"
            message={t(`errors.${rpcError(trips.error)}`)}
            actionLabel={t('common.retry')}
            onAction={() => void trips.refetch()}
          />
        ) : null}
        {trips.data && trips.data.length === 0 ? <EmptyState title={t('helper.home.noTrips')} /> : null}
        {trips.data?.map((trip) => {
          const route = trip.route;
          const bus = trip.bus;
          return (
            <Card
              key={trip.id}
              onPress={() => router.push(`/(helper)/trip/${trip.id}`)}
              accessibilityLabel={locale === 'ar' ? route?.name_ar : route?.name_en}
            >
              <View style={{ gap: spacing[2] }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="button" weight="bold">
                    {trip.direction === 'to_school' ? '🌅 ' : '🌇 '}
                    {t(trip.direction === 'to_school' ? 'helper.home.morning' : 'helper.home.afternoon')}
                  </Text>
                  <View
                    style={{
                      borderRadius: radius,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[1],
                      backgroundColor: STATUS_COLOR[trip.status] ?? colors.muted,
                    }}
                  >
                    <Text variant="caption" style={{ color: colors.onPrimary }}>
                      {t(`status.trip.${trip.status}`)}
                    </Text>
                  </View>
                </View>
                <Text variant="body">{locale === 'ar' ? route?.name_ar : route?.name_en}</Text>
                <Text variant="caption" style={{ color: colors.muted }}>
                  {locale === 'ar' ? bus?.label_ar : bus?.label_en} · {formatTime(trip.scheduled_departure, locale)}
                </Text>
                <Text variant="caption" style={{ color: colors.muted }}>
                  {t('helper.home.students', { count: trip.trip_students.length })}
                </Text>
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
