// Pure helpers for notify-dispatch. No Deno-only APIs, so vitest can run them.
import type { PushMessage } from './expoPush.ts';
import type { Locale } from './i18n/format.ts';
import { renderNotification, type Messages, type NotificationParams } from './i18n/render.ts';

export type DueNotification = {
  id: string;
  type: string;
  params: NotificationParams;
  locale: Locale;
  tokens: string[];
  trip_id: string | null;
  student_id: string | null;
};

export type BuiltMessages = {
  /** One message per (row, token), in row order. */
  messages: PushMessage[];
  /** For each message, the id of the notification row it belongs to. */
  rowIds: string[];
  /** The token each message is sent to. */
  tokens: string[];
  /** Rows with no registered device. They are reported, not sent. */
  noTokens: string[];
};

export function buildMessages(
  rows: DueNotification[],
  messagesByLocale: Record<Locale, Messages>,
): BuiltMessages {
  const built: BuiltMessages = { messages: [], rowIds: [], tokens: [], noTokens: [] };

  for (const row of rows) {
    if (row.tokens.length === 0) {
      built.noTokens.push(row.id);
      continue;
    }
    const { title, body } = renderNotification(messagesByLocale[row.locale], row.type, row.locale, row.params);
    for (const token of row.tokens) {
      built.messages.push({
        to: token,
        title,
        body,
        data: {
          type: row.type,
          trip_id: row.trip_id,
          student_id: row.student_id,
          notification_id: row.id,
        },
        sound: 'default',
        priority: 'high',
        channelId: 'safety',
        interruptionLevel: 'time-sensitive',
      });
      built.rowIds.push(row.id);
      built.tokens.push(token);
    }
  }
  return built;
}
