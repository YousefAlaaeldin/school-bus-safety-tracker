import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { MY_CONTEXT_KEY } from '@/auth/useMyContext';
import { rpcError, supabase } from '@/lib/supabase';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { colors, spacing } from '@/ui/tokens';

export default function InviteScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.rpc('redeem_invite', { p_code: code });
      if (err) {
        setError(t(`errors.${rpcError(err)}`));
        return;
      }
      // The AuthGate re-routes once the context shows the new approved link.
      await queryClient.invalidateQueries({ queryKey: MY_CONTEXT_KEY });
    } catch (e) {
      setError(t(`errors.${rpcError(e)}`));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={{ gap: spacing[4], marginTop: spacing[6] }}>
        <Text variant="title">{t('onboarding.invite.title')}</Text>
        <Text variant="body" style={{ color: colors.muted }}>{t('onboarding.invite.help')}</Text>
        <TextField
          label={t('onboarding.invite.codeLabel')}
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
         
        />
        {error ? <Banner kind="error" message={error} /> : null}
        <Button title={t('onboarding.invite.submit')} onPress={() => void submit()} loading={loading} disabled={code.length !== 8} />
        <Button title={t('common.signOut')} variant="secondary" onPress={() => void supabase.auth.signOut()} />
      </View>
    </Screen>
  );
}
