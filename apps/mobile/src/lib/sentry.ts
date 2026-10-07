import * as Sentry from '@sentry/react-native';

/** Initialises Sentry. Without EXPO_PUBLIC_SENTRY_DSN it does nothing. Never sends personal data. */
export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Remove phone numbers from any place they could appear.
      if (event.user) {
        delete event.user.phone;
        delete event.user.email;
        delete event.user.ip_address;
      }
      const scrub = (text: string) => text.replace(/\+?\d[\d\s-]{7,}\d/g, '[phone]');
      if (event.message) event.message = scrub(event.message);
      for (const ex of event.exception?.values ?? []) {
        if (ex.value) ex.value = scrub(ex.value);
      }
      return event;
    },
  });
}

/** Tags events with the role the user is acting as. */
export function setSentryRole(role: 'parent' | 'helper' | 'admin' | null) {
  Sentry.setTag('role', role ?? 'none');
}

export const captureException = Sentry.captureException;
export const wrap = Sentry.wrap;
