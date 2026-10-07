import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { getLanguage } from '@/i18n';
import { rpcError, supabase } from '@/lib/supabase';
import { useSession } from '@/state/session';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { colors, spacing } from '@/ui/tokens';

export default function StaffScreen() {
  const { t } = useTranslation();
  const setIntent = useSession((s) => s.setIntent);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDashboard = () => {
    const base = process.env.EXPO_PUBLIC_WEB_URL ?? '';
    void WebBrowser.openBrowserAsync(`${base}/${getLanguage()}/dashboard`);
  };

  const signIn = async () => {
    setLoading(true);
    setError(null);
    setIntent('staff');
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        const mapped = rpcError(err);
        setError(mapped === 'NETWORK' ? t('errors.NETWORK') : t('auth.staff.wrongCredentials'));
      }
      // On success the AuthGate routes to the admin home.
    } catch (e) {
      setError(t(`errors.${rpcError(e)}`));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={{ gap: spacing[4], marginTop: spacing[6] }}>
        <Text variant="title">{t('auth.staff.title')}</Text>
        <Text variant="body" style={{ color: colors.muted }}>{t('auth.staff.help')}</Text>
        <Button title={t('auth.staff.openDashboard')} onPress={openDashboard} />

        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing[3] }} />

        <Text variant="button" weight="bold">{t('auth.staff.alertsTitle')}</Text>
        <Text variant="caption" style={{ color: colors.muted }}>{t('auth.staff.alertsHelp')}</Text>
        <TextField
          label={t('auth.staff.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
        />
        <TextField
          label={t('auth.staff.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
        />
        {error ? <Banner kind="error" message={error} /> : null}
        <Button
          title={t('auth.staff.signIn')}
          onPress={() => void signIn()}
          loading={loading}
          disabled={!email.trim() || !password}
        />
      </View>
    </Screen>
  );
}
