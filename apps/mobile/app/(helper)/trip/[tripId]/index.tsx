import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { getLanguage } from '@/i18n';
import { rpcError } from '@/lib/supabase';
import { getActiveTripId } from '@/location/activeTrip';
import { startBusTracking } from '@/location/backgroundTask';
import { checkPermissions } from '@/location/ensurePermissions';
import { useHelperAction } from '@/queue/useHelperAction';
import { useTrip } from '@/trip/useTrip';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Spinner } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { colors, spacing } from '@/ui/tokens';

export default function TripRouter() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = getLanguage();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trip, students, groups, counts, stops, loading, error, refetch } = useTrip(tripId);
  const run = useHelperAction();
  const [message, setMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [permissionAsked, setPermissionAsked] = useState(false);
  const [permission, setPermission] = useState<string | null>(null);

  // Re-check when coming back from the permissions screen.
  useEffect(() => {
    void checkPermissions().then(setPermission);
  }, [permissionAsked, starting]);

  // Share the bus location while the trip is under way (also when an already started trip is reopened).
  useEffect(() => {
    if (!trip || (trip.status !== 'roll_call' && trip.status !== 'in_progress')) return;
    void getActiveTripId().then((active) => {
      if (active !== trip.id) void startBusTracking(trip.id, t).catch(() => {});
    });
  }, [trip?.id, trip?.status, t]);

  // Send the helper to the right screen for the direction and status.
  useEffect(() => {
    if (!trip) return;
    if (trip.direction === 'from_school' && trip.status === 'roll_call') {
      router.replace(`/(helper)/trip/${tripId}/roll-call`);
    } else if (trip.direction === 'from_school' && trip.status === 'in_progress') {
      router.replace(`/(helper)/trip/${tripId}/drop`);
    } else if (trip.direction === 'to_school' && trip.status === 'in_progress') {
      router.replace(`/(helper)/trip/${tripId}/pickup`);
    }
  }, [trip, tripId, router]);

  if (loading) return <Spinner />;
  if (error || !trip) {
    return (
      <Screen>
        <View style={{ marginTop: spacing[5] }}>
          <Banner
            kind="error"
            message={t(`errors.${rpcError(error)}`)}
            actionLabel={t('common.retry')}
            onAction={() => void refetch()}
          />
        </View>
      </Screen>
    );
  }

  const startTrip = async () => {
    setStarting(true);
    setMessage(null);
    try {
      // Anything less than full permission goes through the explainer first. The helper may still
      // come back and start with foreground-only access, which shows a warning below.
      if (!permissionAsked && (await checkPermissions()) !== 'ok') {
        setPermissionAsked(true);
        router.push('/(helper)/permissions');
        return;
      }
      await run('start_trip', { p_trip_id: tripId });
    } finally {
      setStarting(false);
    }
  };

  const firstGroup = groups?.[0];
  const firstStop = firstGroup ? stops?.[firstGroup.stop_id] : undefined;
  const routeName = locale === 'ar' ? trip.route?.name_ar : trip.route?.name_en;
  const busLabel = locale === 'ar' ? trip.bus?.label_ar : trip.bus?.label_en;

  if (trip.status === 'scheduled') {
    return (
      <Screen scroll>
        <View style={{ gap: spacing[4], marginTop: spacing[4] }}>
          <Text variant="title">{routeName}</Text>
          <Card>
            <Text variant="caption" style={{ color: colors.muted }}>{t('helper.trip.bus')}</Text>
            <Text variant="body">{busLabel}</Text>
            <Text variant="caption" style={{ color: colors.muted, marginTop: spacing[3] }}>
              {t('helper.trip.studentsCount')}
            </Text>
            <Text variant="body">{students?.length ?? 0}</Text>
            {firstStop ? (
              <>
                <Text variant="caption" style={{ color: colors.muted, marginTop: spacing[3] }}>
                  {t('helper.trip.firstStop')}
                </Text>
                <Text variant="body">{locale === 'ar' ? firstStop.label_ar : firstStop.label_en}</Text>
              </>
            ) : null}
          </Card>
          {permission === 'needsBackground' ? (
            <Banner kind="warning" message={t('permissions.location.foregroundOnly')} />
          ) : null}
          {message ? <Banner kind="warning" message={message} /> : null}
          <Button title={t('helper.trip.start')} onPress={() => void startTrip()} loading={starting} />
        </View>
      </Screen>
    );
  }

  // completed or cancelled: a read-only summary
  return (
    <Screen scroll>
      <View style={{ gap: spacing[4], marginTop: spacing[4] }}>
        <Text variant="title">{t('helper.trip.completedTitle')}</Text>
        <Text variant="body" style={{ color: colors.muted }}>{routeName}</Text>
        <Card>
          {counts
            ? (Object.entries(counts) as [string, number][])
                .filter(([, n]) => n > 0)
                .map(([status, n]) => (
                  <View key={status} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text variant="body">{t(`status.student.${status}`)}</Text>
                    <Text variant="body" weight="bold">{n}</Text>
                  </View>
                ))
            : null}
        </Card>
        <Button title={t('helper.trip.backHome')} onPress={() => router.replace('/(helper)')} />
      </View>
    </Screen>
  );
}
