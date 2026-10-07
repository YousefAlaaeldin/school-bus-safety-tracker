import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { rpcError, supabase } from '@/lib/supabase';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { PhoneField } from '@/ui/PhoneField';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { colors, spacing } from '@/ui/tokens';

export default function PhoneScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const [phone, setPhone] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!phone) {
      setTouched(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({ phone });
      if (err) {
        setError(t(`errors.${rpcError(err)}`));
        return;
      }
      router.push({ pathname: '/(public)/otp', params: { phone, intent: intent ?? '' } });
    } catch (e) {
      setError(t(`errors.${rpcError(e)}`));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={{ gap: spacing[4], marginTop: spacing[6] }}>
        <Text variant="title">{t('auth.phoneTitle')}</Text>
        <Text variant="body" style={{ color: colors.muted }}>{t('auth.phoneHelp')}</Text>
        <PhoneField
          testID="phone-input"
          onChangeE164={setPhone}
          error={touched && !phone ? t('auth.invalidPhone') : null}
        />
        {error ? (
          <Banner kind="error" message={error} actionLabel={t('common.retry')} onAction={() => void submit()} />
        ) : null}
        <Button testID="phone-continue" title={t('auth.continue')} onPress={() => void submit()} loading={loading} disabled={!phone} />
      </View>
    </Screen>
  );
}
