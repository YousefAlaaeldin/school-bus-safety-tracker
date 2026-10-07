import AsyncStorage from '@react-native-async-storage/async-storage';
import { resources, type Locale } from '@sst/i18n';
import { getLocales } from 'expo-localization';
import * as Updates from 'expo-updates';
import i18next from 'i18next';
import { DevSettings, I18nManager } from 'react-native';

const STORAGE_KEY = 'locale';

async function reload(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    // Updates.reloadAsync is unavailable in Expo Go / dev builds.
    if (__DEV__) DevSettings.reload();
  }
}

function applyDirection(locale: Locale): boolean {
  const wantRtl = locale === 'ar';
  if (I18nManager.isRTL === wantRtl) return false;
  I18nManager.allowRTL(wantRtl);
  I18nManager.forceRTL(wantRtl);
  return true;
}

function deviceLocale(): Locale {
  return getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';
}

async function storedLocale(): Promise<Locale> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  return saved === 'ar' || saved === 'en' ? saved : deviceLocale();
}

/** Initialises i18next. Returns true if the app is about to reload to flip layout direction. */
export async function initI18n(): Promise<{ reloading: boolean }> {
  const locale = await storedLocale();
  await i18next.init({
    resources,
    lng: locale,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

  if (applyDirection(locale)) {
    await reload();
    return { reloading: true };
  }
  return { reloading: false };
}

export async function setLanguage(locale: Locale): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, locale);
  await i18next.changeLanguage(locale);
  if (applyDirection(locale)) await reload();
}

export function getLanguage(): Locale {
  return i18next.language === 'ar' ? 'ar' : 'en';
}

export { i18next };
