import en from './en.json';
import ar from './ar.json';

export const resources = {
  en: { translation: en },
  ar: { translation: ar },
};

export type { Locale } from './format';
export { TIME_ZONE, formatTime, formatDate, isolate } from './format';
export { renderNotification } from './render';
export type { NotificationParams, Messages } from './render';
