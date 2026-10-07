import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getLanguage, setLanguage } from '@/i18n';
import { useSession } from '@/state/session';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { colors, spacing } from '@/ui/tokens';

function LanguageToggle() {
  const { t } = useTranslation();
  const current = getLanguage();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[3], paddingVertical: spacing[3] }}>
      {(['ar', 'en'] as const).map((code) => (
        <Pressable
          key={code}
          testID={`welcome-lang-${code}`}
          accessibilityRole="button"
          accessibilityState={{ selected: current === code }}
          onPress={() => void setLanguage(code)}
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing[2] }}
        >
          <Text
            variant="button"
            weight={current === code ? 'bold' : 'regular'}
            style={{ color: current === code ? colors.primary : colors.muted }}
          >
            {t(code === 'ar' ? 'common.arabic' : 'common.english')}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function RoleCard({
  icon,
  title,
  subtitle,
  onPress,
  testID,
}: {
  testID: string;
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Card testID={testID} onPress={onPress} accessibilityLabel={title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
        <Text style={{ fontSize: 32, lineHeight: 40 }}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text variant="button" weight="bold">{title}</Text>
          <Text variant="caption" style={{ color: colors.muted }}>{subtitle}</Text>
        </View>
      </View>
    </Card>
  );
}

export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();
  const setIntent = useSession((s) => s.setIntent);

  const pick = (intent: 'parent' | 'helper') => {
    setIntent(intent);
    router.push({ pathname: '/(public)/phone', params: { intent } });
  };

  return (
    <Screen scroll>
      <LanguageToggle />
      <View style={{ gap: spacing[2], marginBottom: spacing[6], marginTop: spacing[5] }}>
        <Text variant="title">{t('common.appName')}</Text>
        <Text variant="body" style={{ color: colors.muted }}>{t('welcome.tagline')}</Text>
      </View>
      <View style={{ gap: spacing[3] }}>
        <RoleCard
          testID="welcome-parent"
          icon="👨‍👩‍👧"
          title={t('welcome.parentTitle')}
          subtitle={t('welcome.parentSubtitle')}
          onPress={() => pick('parent')}
        />
        <RoleCard
          testID="welcome-helper"
          icon="🚌"
          title={t('welcome.helperTitle')}
          subtitle={t('welcome.helperSubtitle')}
          onPress={() => pick('helper')}
        />
        <RoleCard
          testID="welcome-staff"
          icon="🏫"
          title={t('welcome.staffTitle')}
          subtitle={t('welcome.staffSubtitle')}
          onPress={() => router.push('/(public)/staff')}
        />
      </View>
    </Screen>
  );
}
