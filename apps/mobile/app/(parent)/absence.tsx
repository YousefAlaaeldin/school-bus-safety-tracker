import { formatDate } from '@sst/i18n';
import { addDays, todayInDubai, type TripDirection } from '@sst/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { getLanguage } from '@/i18n';
import { rpcError, supabase } from '@/lib/supabase';
import { PARENT_HOME_KEY, useParentHome } from '@/parent/useParentHome';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Spinner } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { colors, radius, spacing } from '@/ui/tokens';

const MAX_DAYS_AHEAD = 30;
const UPCOMING_KEY = ['absences', 'upcoming'] as const;

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
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
}

export default function AbsenceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = getLanguage();
  const queryClient = useQueryClient();
  const { studentId: presetStudent } = useLocalSearchParams<{ studentId?: string }>();
  const home = useParentHome();

  const today = todayInDubai(new Date());
  const days = useMemo(() => Array.from({ length: MAX_DAYS_AHEAD + 1 }, (_, i) => addDays(today, i)), [today]);

  const [studentId, setStudentId] = useState<string | null>(presetStudent ?? null);
  const [date, setDate] = useState(today);
  const [directions, setDirections] = useState<TripDirection[]>(['to_school', 'from_school']);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const children = home.data ?? [];
  const selected = studentId ?? children[0]?.id ?? null;
  const name = (c: { name_ar: string; name_en: string }) => (locale === 'ar' ? c.name_ar : c.name_en);

  const upcoming = useQuery({
    queryKey: UPCOMING_KEY,
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('absence_reports')
        .select('id, student_id, service_date, direction, reason')
        .gte('service_date', today)
        .order('service_date');
      if (err) throw err;
      return data ?? [];
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: UPCOMING_KEY });
    void queryClient.invalidateQueries({ queryKey: PARENT_HOME_KEY });
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const { error: err } = await supabase.rpc('report_absence', {
        p_student_id: selected,
        p_service_date: date,
        p_directions: directions,
        p_reason: reason.trim(),
      });
      if (err) throw err;
    },
    onSuccess: () => {
      setError(null);
      setDone(true);
      setReason('');
      refresh();
    },
    onError: (e) => {
      setDone(false);
      setError(t(`errors.${rpcError(e)}`));
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await supabase.rpc('cancel_absence', { p_absence_id: id });
      if (err) throw err;
    },
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (e) => setError(t(`errors.${rpcError(e)}`)),
  });

  const toggle = (d: TripDirection) =>
    setDirections((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]));

  if (home.isLoading) return <Spinner />;

  const dateLabel = (d: string) =>
    d === today ? t('parent.absence.today') : d === addDays(today, 1) ? t('parent.absence.tomorrow') : formatDate(d, locale);
  const childName = (id: string) => {
    const c = children.find((x) => x.id === id);
    return c ? name(c) : '';
  };

  return (
    <Screen scroll>
      <View style={{ gap: spacing[4] }}>
        <Text variant="title">{t('parent.absence.title')}</Text>

        {children.length > 1 ? (
          <View style={{ gap: spacing[2] }}>
            <Text variant="caption" style={{ color: colors.muted }}>{t('parent.absence.child')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
              {children.map((c) => (
                <Chip key={c.id} label={name(c)} selected={c.id === selected} onPress={() => setStudentId(c.id)} />
              ))}
            </View>
          </View>
        ) : children[0] ? (
          <Text variant="body">{name(children[0])}</Text>
        ) : null}

        <View style={{ gap: spacing[2] }}>
          <Text variant="caption" style={{ color: colors.muted }}>{t('parent.absence.date')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
            {days.map((d) => (
              <Chip key={d} label={dateLabel(d)} selected={d === date} onPress={() => setDate(d)} />
            ))}
          </ScrollView>
        </View>

        <View style={{ gap: spacing[2] }}>
          <Text variant="caption" style={{ color: colors.muted }}>{t('parent.absence.journeys')}</Text>
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            <Chip label={t('parent.home.morning')} selected={directions.includes('to_school')} onPress={() => toggle('to_school')} />
            <Chip label={t('parent.home.afternoon')} selected={directions.includes('from_school')} onPress={() => toggle('from_school')} />
          </View>
        </View>

        <TextField
          label={t('parent.absence.reason')}
          value={reason}
          onChangeText={setReason}
          multiline
          maxLength={200}
        />

        <Text variant="caption" style={{ color: colors.muted }}>{t('parent.absence.cutoffHelp')}</Text>
        {error ? <Banner kind="error" message={error} /> : null}
        {done ? <Banner kind="success" message={t('parent.absence.saved')} /> : null}

        <Button
          title={t('parent.absence.submit')}
          loading={submit.isPending}
          disabled={!selected || directions.length === 0}
          onPress={() => {
            setDone(false);
            submit.mutate();
          }}
        />
        <Button title={t('common.back')} variant="secondary" onPress={() => router.back()} />

        <Text variant="title">{t('parent.absence.upcoming')}</Text>
        {upcoming.isLoading ? <Spinner /> : null}
        {upcoming.data && upcoming.data.length === 0 ? (
          <Text variant="body" style={{ color: colors.muted }}>{t('parent.absence.none')}</Text>
        ) : null}
        {(upcoming.data ?? []).map((a) => (
          <Card key={a.id} style={{ gap: spacing[2] }}>
            <Text variant="body">{childName(a.student_id)}</Text>
            <Text variant="caption" style={{ color: colors.muted }}>
              {dateLabel(a.service_date)} · {a.direction === 'to_school' ? t('parent.home.morning') : t('parent.home.afternoon')}
            </Text>
            <Button
              title={t('common.cancel')}
              variant="secondary"
              loading={cancel.isPending && cancel.variables === a.id}
              onPress={() => cancel.mutate(a.id)}
            />
          </Card>
        ))}
      </View>
    </Screen>
  );
}
