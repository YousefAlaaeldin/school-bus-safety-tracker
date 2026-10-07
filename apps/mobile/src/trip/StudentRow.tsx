import type { StudentView } from '@sst/shared';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { getLanguage } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { Text } from '@/ui/Text';
import { colors, radius, spacing } from '@/ui/tokens';

const BUCKET = 'student-photos';

/** A signed URL for a student photo, cached for most of its lifetime. */
function usePhotoUrl(photoPath: string | null) {
  return useQuery({
    queryKey: ['photo', photoPath],
    enabled: !!photoPath,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const objectPath = photoPath!.startsWith(`${BUCKET}/`) ? photoPath!.slice(BUCKET.length + 1) : photoPath!;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(objectPath, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  }).data;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function studentName(s: Pick<StudentView, 'name_ar' | 'name_en'>): string {
  return getLanguage() === 'ar' ? s.name_ar : s.name_en;
}

export function StudentPhoto({ student, size = 48 }: { student: Pick<StudentView, 'name_ar' | 'name_en' | 'photo_path'>; size?: number }) {
  const url = usePhotoUrl(student.photo_path);
  return url ? (
    <Image
      source={{ uri: url }}
      cachePolicy="disk"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.border }}
      accessibilityIgnoresInvertColors
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="button" style={{ color: colors.muted }}>{initials(student.name_en || student.name_ar)}</Text>
    </View>
  );
}

type Props = {
  student: StudentView;
  /** Tapping the row (the big toggle area). */
  onPress?: () => void;
  /** Long-press menu (e.g. return to school). */
  onLongPress?: () => void;
  /** Extra controls on the end side (buttons). */
  trailing?: ReactNode;
  /** Strike the name through (e.g. dropped). */
  struck?: boolean;
  /** Replaces the default status indicator. */
  indicator?: ReactNode;
};

/** One student: photo, name, a state indicator, a pending spinner dot and any failed-action error. */
export function StudentRow({ student, onPress, onLongPress, trailing, struck, indicator }: Props) {
  const { t } = useTranslation();
  const absent = student.status === 'absent_reported';
  const boarded = student.status === 'boarded';

  const defaultIndicator = boarded ? (
    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.onPrimary }}>✓</Text>
    </View>
  ) : (
    <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.border }} />
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 64,
        gap: spacing[3],
        padding: spacing[3],
        backgroundColor: colors.surface,
        borderRadius: radius,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: absent ? 0.55 : 1,
      }}
    >
      <Pressable
        testID={`student-row-${student.student_id}`}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={studentName(student)}
        accessibilityState={{ checked: boarded }}
        disabled={!onPress && !onLongPress}
        onPress={onPress}
        onLongPress={onLongPress}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 56 }}
      >
        <StudentPhoto student={student} />
        <View style={{ flex: 1 }}>
          <Text variant="body" weight="medium" style={struck ? { textDecorationLine: 'line-through' } : undefined}>
            {studentName(student)}
          </Text>
          {absent ? <Text variant="caption" style={{ color: colors.muted }}>{t('helper.rollCall.absent')}</Text> : null}
          {student.failedError ? (
            <Text variant="caption" style={{ color: colors.danger }}>{t(`errors.${student.failedError}`)}</Text>
          ) : null}
        </View>
        {student.pending ? <ActivityIndicator size="small" color={colors.muted} /> : null}
        {indicator ?? defaultIndicator}
      </Pressable>
      {trailing}
    </View>
  );
}
