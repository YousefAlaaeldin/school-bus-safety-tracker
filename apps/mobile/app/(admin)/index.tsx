import { formatTime } from '@sst/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLanguage } from '@/i18n';
import { rpcError, supabase } from '@/lib/supabase';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState, Spinner } from '@/ui/EmptyState';
import { Text } from '@/ui/Text';
import { colors, radius, spacing } from '@/ui/tokens';

type Severity = 'info' | 'warning' | 'critical';

type AlertItem = {
  id: string;
  type: string;
  severity: Severity;
  created_at: string;
  acknowledged_at: string | null;
  studentNames: string[];
  reason: string | null;
  bus: string | null;
};

// Colour and an icon, so severity never relies on colour alone.
const SEVERITY: Record<Severity, { color: string; icon: string }> = {
  info: { color: colors.primary, icon: 'ℹ️' },
  warning: { color: colors.warning, icon: '⚠️' },
  critical: { color: colors.danger, icon: '🚨' },
};

const ALERTS_KEY = ['admin-alerts'] as const;

async function loadAlerts(showAll: boolean, ar: boolean): Promise<AlertItem[]> {
  let query = supabase
    .from('alerts')
    .select('id, type, severity, payload, created_at, acknowledged_at, trip:trips(bus:buses(label_ar, label_en))')
    .order('created_at', { ascending: false })
    .limit(100);
  if (!showAll) query = query.is('acknowledged_at', null);
  const { data: rows, error } = await query;
  if (error) throw error;

  const ids = new Set<string>();
  for (const r of rows ?? []) {
    const p = (r.payload ?? {}) as { student_ids?: string[]; student_id?: string };
    for (const id of p.student_ids ?? []) ids.add(id);
    if (p.student_id) ids.add(p.student_id);
  }
  const { data: students } = ids.size
    ? await supabase.from('students').select('id, name_ar, name_en').in('id', [...ids])
    : { data: [] };
  const nameOf = new Map((students ?? []).map((s) => [s.id, ar ? s.name_ar : s.name_en]));

  return (rows ?? []).map((r) => {
    const p = (r.payload ?? {}) as { student_ids?: string[]; student_id?: string; reason?: string };
    const studentIds = [...(p.student_ids ?? []), ...(p.student_id ? [p.student_id] : [])];
    return {
      id: r.id,
      type: r.type,
      severity: r.severity as Severity,
      created_at: r.created_at,
      acknowledged_at: r.acknowledged_at,
      studentNames: studentIds.map((id) => nameOf.get(id)).filter((n): n is string => !!n),
      reason: p.reason ?? null,
      bus: r.trip?.bus ? (ar ? r.trip.bus.label_ar : r.trip.bus.label_en) : null,
    };
  });
}

export default function AdminAlerts() {
  const { t } = useTranslation();
  const locale = getLanguage();
  const ar = locale === 'ar';
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const alerts = useQuery({ queryKey: [...ALERTS_KEY, showAll, locale], queryFn: () => loadAlerts(showAll, ar) });
  // The open count is independent of the filter chip.
  const openCount = useQuery({
    queryKey: [...ALERTS_KEY, 'count'],
    queryFn: async () => {
      const { count, error } = await supabase.from('alerts').select('id', { count: 'exact', head: true }).is('acknowledged_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // New and updated alerts (RLS limits them to my schools) appear live.
  useEffect(() => {
    const channel = supabase
      .channel('admin-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        void queryClient.invalidateQueries({ queryKey: ALERTS_KEY });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const acknowledge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('acknowledge_alert', { p_alert_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ALERTS_KEY });
    },
    onError: (e) => setActionError(t(`errors.${rpcError(e)}`)),
  });

  const openDashboard = () => {
    const base = process.env.EXPO_PUBLIC_WEB_URL ?? '';
    void WebBrowser.openBrowserAsync(`${base}/${locale}/dashboard`);
  };

  const chip = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 44,
        paddingHorizontal: spacing[4],
        borderRadius: radius,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary : colors.surface,
        justifyContent: 'center',
      }}
    >
      <Text variant="body" style={{ color: selected ? colors.onPrimary : colors.text }}>{label}</Text>
    </Pressable>
  );

  if (alerts.isLoading) return <Spinner />;
  if (alerts.error) {
    return (
      <EmptyState
        title={t(`errors.${rpcError(alerts.error)}`)}
        actionLabel={t('common.retry')}
        onAction={() => void alerts.refetch()}
      />
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing[4], paddingTop: insets.top + spacing[4], gap: spacing[4] }}
      refreshControl={<RefreshControl refreshing={alerts.isRefetching} onRefresh={() => void alerts.refetch()} />}
    >
      <Text variant="title">{t('admin.home.title')}</Text>
      <Text variant="body" style={{ color: colors.muted }}>{t('admin.alerts.openCount', { count: openCount.data ?? 0 })}</Text>
      <Button title={t('admin.alerts.openDashboard')} variant="secondary" onPress={openDashboard} />

      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        {chip(t('admin.alerts.filterOpen'), !showAll, () => setShowAll(false))}
        {chip(t('admin.alerts.filterAll'), showAll, () => setShowAll(true))}
      </View>

      {actionError ? <Banner kind="error" message={actionError} /> : null}
      {alerts.data?.length === 0 ? <Text variant="body" style={{ color: colors.muted }}>{t('admin.alerts.empty')}</Text> : null}

      {(alerts.data ?? []).map((a) => {
        const sev = SEVERITY[a.severity] ?? SEVERITY.info;
        return (
          <Card key={a.id} style={{ gap: spacing[2], borderStartWidth: 6, borderStartColor: sev.color }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              <Text variant="body" accessibilityLabel={t(`admin.alerts.severity.${a.severity}`)}>{sev.icon}</Text>
              <Text variant="caption" style={{ color: sev.color }}>{t(`admin.alerts.severity.${a.severity}`)}</Text>
              <Text variant="caption" style={{ color: colors.muted, marginStart: 'auto' }}>
                {`⁦${formatTime(a.created_at, locale)}⁩`}
              </Text>
            </View>
            <Text variant="title">{t(`admin.alerts.${a.type}`)}</Text>
            {a.bus ? <Text variant="body" style={{ color: colors.muted }}>{t('admin.alerts.bus', { bus: a.bus })}</Text> : null}
            {a.studentNames.length > 0 ? (
              <Text variant="body">{t('admin.alerts.students', { names: a.studentNames.join(ar ? '، ' : ', ') })}</Text>
            ) : null}
            {a.reason ? <Text variant="body">{t('admin.alerts.reason', { reason: a.reason })}</Text> : null}
            {a.acknowledged_at ? (
              <Text variant="caption" style={{ color: colors.muted }}>{t('admin.alerts.acknowledged')}</Text>
            ) : (
              <Button
                title={t('admin.alerts.acknowledge')}
                loading={acknowledge.isPending && acknowledge.variables === a.id}
                onPress={() => acknowledge.mutate(a.id)}
              />
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}
