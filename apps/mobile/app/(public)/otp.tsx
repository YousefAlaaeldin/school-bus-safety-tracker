import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { rpcError, supabase } from '@/lib/supabase';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { FONT_FAMILY } from '@/ui/fonts';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { colors, radius, spacing } from '@/ui/tokens';

const RESEND_SECONDS = 30;

export default function OtpScreen() {
  const { t } = useTranslation();
  const { phone } = useLocalSearchParams<{ phone?: string; intent?: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const verify = useCallback(
    async (token: string) => {
      if (!phone) return;
      setLoading(true);
      setError(null);
      try {
        const { error: err } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
        if (err) {
          // Wrong or expired codes come back as an auth error; anything else is a network problem.
          const mapped = rpcError(err);
          setError(mapped === 'NETWORK' ? t('errors.NETWORK') : t('auth.wrongCode'));
          setCode('');
        }
        // On success the AuthGate routes the user.
      } catch (e) {
        setError(t(`errors.${rpcError(e)}`));
      } finally {
        setLoading(false);
      }
    },
    [phone, t],
  );

  const onChange = (text: string) => {
    const western = text.replace(/[٠-٩۰-۹]/g, (c) => String(c.charCodeAt(0) & 0xf));
    const digits = western.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) void verify(digits);
  };

  const resend = async () => {
    if (!phone || seconds > 0) return;
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ phone });
    if (err) setError(t(`errors.${rpcError(err)}`));
    else setSeconds(RESEND_SECONDS);
  };

  return (
    <Screen scroll>
      <View style={{ gap: spacing[4], marginTop: spacing[6] }}>
        <Text variant="title">{t('auth.otpTitle')}</Text>
        <Text variant="body" style={{ color: colors.muted }}>
          {t('auth.otpHelp', { phone: `⁦${phone ?? ''}⁩` })}
        </Text>
        <TextInput
          accessibilityLabel={t('auth.otpTitle')}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={6}
          autoFocus
          editable={!loading}
          style={{
            minHeight: 64,
            borderRadius: radius,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.surface,
            textAlign: 'center',
            writingDirection: 'ltr',
            letterSpacing: 8,
            fontSize: 28,
            fontFamily: FONT_FAMILY.medium,
            color: colors.text,
          }}
        />
        {error ? <Banner kind="error" message={error} /> : null}
        <Button
          title={seconds > 0 ? t('auth.resendIn', { seconds }) : t('auth.resend')}
          variant="secondary"
          onPress={() => void resend()}
          disabled={seconds > 0}
          loading={loading}
        />
      </View>
    </Screen>
  );
}
