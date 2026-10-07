import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';
import { i18next } from '@/i18n';
import { supabase } from '@/lib/supabase';

const TOKEN_KEY = 'push-token';
const ASKED_KEY = 'push-explained';

export const ANDROID_CHANNEL = 'safety';

/** Creates the Android notification channel (a no-op on iOS). Safe to call repeatedly. */
export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: i18next.t('parent.notifications.channelName'),
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
}

/** Explains why notifications are needed, once, before the system prompt. Resolves true to continue. */
function explain(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      i18next.t('permissions.notifications.title'),
      i18next.t('permissions.notifications.why'),
      [
        { text: i18next.t('permissions.notifications.later'), style: 'cancel', onPress: () => resolve(false) },
        { text: i18next.t('permissions.notifications.allow'), onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}

async function saveToken(token: string) {
  const { error } = await supabase.rpc('register_push_token', {
    p_token: token,
    p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
  if (error) throw error;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

/**
 * Registers this device for push. Call after sign-in, for every role. Never throws: a failure here must not
 * affect the app. Returns the token, or null when skipped (simulator, permission refused, offline).
 */
export async function registerForPush(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    await ensureAndroidChannel();

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      if (!(await explain())) return null;
      ({ status } = await Notifications.requestPermissionsAsync());
      await AsyncStorage.setItem(ASKED_KEY, '1');
      if (status !== 'granted') return null;
    }

    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await saveToken(token);
    return token;
  } catch {
    return null;
  }
}

/** Re-saves the token whenever Expo rotates it. Returns the unsubscribe function. */
export function watchPushToken(): () => void {
  const sub = Notifications.addPushTokenListener(() => {
    void registerForPush();
  });
  return () => sub.remove();
}

/** Removes this device's token from the server (sign-out). Never throws. */
export async function unregisterPush() {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await supabase.rpc('unregister_push_token', { p_token: token });
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // offline or already gone: signing out must still work
  }
}
