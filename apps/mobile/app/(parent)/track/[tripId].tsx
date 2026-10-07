import { formatTime } from '@sst/i18n';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import MapView, { AnimatedRegion, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { getLanguage } from '@/i18n';
import { rpcError } from '@/lib/supabase';
import { useBusPosition } from '@/parent/useBusPosition';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState, Spinner } from '@/ui/EmptyState';
import { Text } from '@/ui/Text';
import { colors, spacing } from '@/ui/tokens';

const STALE_AFTER_S = 60;
const APPROACHING_MS = 10 * 60 * 1000;

export default function TrackScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = getLanguage();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { position, lastUpdate, notPermitted, view, loading, error, refetch } = useBusPosition(tripId);

  const mapRef = useRef<MapView>(null);
  const busCoord = useRef(new AnimatedRegion({ latitude: 25.2048, longitude: 55.2708, latitudeDelta: 0, longitudeDelta: 0 })).current;
  const [now, setNow] = useState(Date.now());

  // "Updated N s ago" ticks every few seconds.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  // The bus marker glides between updates.
  useEffect(() => {
    if (!position) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-native-maps' AnimatedRegion.timing is untyped for this config
    (busCoord as any).timing({ latitude: position.lat, longitude: position.lng, duration: 1000, useNativeDriver: false }).start();
  }, [position, busCoord]);

  const child = view?.children[0] ?? null;
  const stop = child?.stop ?? null;

  // Frame the bus and the child's stop once both are known.
  useEffect(() => {
    if (!position) return;
    const coords = [{ latitude: position.lat, longitude: position.lng }];
    if (stop) coords.push({ latitude: stop.lat, longitude: stop.lng });
    const id = setTimeout(
      () => mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 80, right: 60, bottom: 220, left: 60 }, animated: true }),
      300,
    );
    return () => clearTimeout(id);
    // Only re-frame when the stop changes or the first position arrives.
  }, [stop?.lat, stop?.lng, position === null]);

  if (loading) return <Spinner />;
  if (error) {
    return (
      <EmptyState title={t(`errors.${rpcError(error)}`)} actionLabel={t('common.retry')} onAction={() => void refetch()} />
    );
  }
  if (notPermitted) {
    return (
      <EmptyState title={t('parent.track.ended')} actionLabel={t('common.back')} onAction={() => router.back()} />
    );
  }

  const seconds = lastUpdate ? Math.max(0, Math.round((now - new Date(lastUpdate).getTime()) / 1000)) : null;
  const stale = seconds !== null && seconds > STALE_AFTER_S;
  const name = child ? (locale === 'ar' ? child.name_ar : child.name_en) : '';
  const busLabel = view?.bus ? (locale === 'ar' ? view.bus.label_ar : view.bus.label_en) : '';
  const eta = child?.eta_at ? `⁦${formatTime(child.eta_at, locale)}⁩` : null;
  const msToEta = child?.eta_at ? new Date(child.eta_at).getTime() - now : null;
  const approaching = msToEta !== null && msToEta < APPROACHING_MS;

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        // Maps are never mirrored in RTL.
        initialRegion={{ latitude: 25.2048, longitude: 55.2708, latitudeDelta: 0.2, longitudeDelta: 0.2 }}
      >
        {position ? (
          <Marker.Animated
            coordinate={busCoord as never}
            rotation={position.heading ?? 0}
            flat
            anchor={{ x: 0.5, y: 0.5 }}
            title={busLabel}
            tracksViewChanges={false}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}>
              <Text variant="body">🚌</Text>
            </View>
          </Marker.Animated>
        ) : null}
        {stop ? (
          <Marker
            coordinate={{ latitude: stop.lat, longitude: stop.lng }}
            title={locale === 'ar' ? stop.label_ar : stop.label_en}
            pinColor={colors.danger}
            tracksViewChanges={false}
          />
        ) : null}
      </MapView>

      <View style={{ position: 'absolute', start: spacing[4], end: spacing[4], bottom: spacing[5], gap: spacing[3] }}>
        {stale ? <Banner kind="warning" message={t('parent.track.stale')} /> : null}
        <Card style={{ gap: spacing[2], ...(approaching ? { borderColor: colors.primary, borderWidth: 2, backgroundColor: '#E8F5EE' } : null) }}>
          <Text variant="title">{name}</Text>
          <Text variant="body" style={{ color: colors.muted }}>
            {position ? busLabel : t('parent.track.waiting')}
          </Text>
          {eta ? (
            <Text variant="body" weight={approaching ? 'bold' : undefined}>
              {t('parent.track.eta', { time: eta })}
              {child?.eta_source === 'fallback' ? ` ${t('parent.track.estimate')}` : ''}
            </Text>
          ) : null}
          {seconds !== null ? (
            <Text variant="caption" style={{ color: colors.muted }}>{t('parent.track.updated', { seconds })}</Text>
          ) : null}
          <Button title={t('common.back')} variant="secondary" onPress={() => router.back()} />
        </Card>
      </View>
    </View>
  );
}
