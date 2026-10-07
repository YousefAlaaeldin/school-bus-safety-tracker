import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'SafeRide',
  slug: 'saferide',
  scheme: 'saferide',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'ae.saferide.app',
    supportsTablet: false,
  },
  android: {
    package: 'ae.saferide.app',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    config: {
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY },
    },
  },
  plugins: [
    'expo-router',
    // supportsRTL is set both here (the documented plugin option) and in `extra` below.
    ['expo-localization', { supportsRTL: true }],
    'expo-font',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow SafeRide to share the bus location with parents during a trip, even when the app is closed.',
        locationWhenInUsePermission: 'Allow SafeRide to show the bus position during a trip.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    'expo-notifications',
    'expo-task-manager',
  ],
  extra: {
    supportsRTL: true,
  },
};

export default config;
