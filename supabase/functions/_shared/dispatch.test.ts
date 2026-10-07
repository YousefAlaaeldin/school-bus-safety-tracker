import { describe, expect, it } from 'vitest';
import { buildMessages, type DueNotification } from './dispatch';
import ar from './i18n/ar.json';
import en from './i18n/en.json';

const messages = { en, ar };

const row = (over: Partial<DueNotification> = {}): DueNotification => ({
  id: 'n1',
  type: 'boarded',
  params: { child_en: 'Sara', child_ar: 'سارة', bus_en: 'Bus 12', bus_ar: 'حافلة 12', time_iso: '2030-01-07T11:07:00Z' },
  locale: 'en',
  tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'],
  trip_id: 't1',
  student_id: 's1',
  ...over,
});

describe('buildMessages', () => {
  it('makes one message per token', () => {
    const built = buildMessages([row()], messages);
    expect(built.messages).toHaveLength(2);
    expect(built.rowIds).toEqual(['n1', 'n1']);
    expect(built.tokens).toEqual(['ExponentPushToken[a]', 'ExponentPushToken[b]']);
    expect(built.messages[0]).toMatchObject({
      to: 'ExponentPushToken[a]',
      title: 'Sara is on the bus',
      sound: 'default',
      priority: 'high',
      channelId: 'safety',
      interruptionLevel: 'time-sensitive',
      data: { type: 'boarded', trip_id: 't1', student_id: 's1', notification_id: 'n1' },
    });
  });

  it('uses the Arabic template for an ar recipient', () => {
    const built = buildMessages([row({ locale: 'ar', type: 'picked_up' })], messages);
    expect(built.messages[0]?.title).toContain('تم اصطحاب');
    expect(built.messages[0]?.title).toContain('سارة');
  });

  it('reports rows without tokens and sends nothing for them', () => {
    const built = buildMessages([row({ id: 'n2', tokens: [] }), row({ id: 'n3' })], messages);
    expect(built.noTokens).toEqual(['n2']);
    expect(built.messages.every((m) => m.data.notification_id === 'n3')).toBe(true);
  });

  it('keeps null ids as null in the payload', () => {
    const built = buildMessages([row({ trip_id: null, student_id: null })], messages);
    expect(built.messages[0]?.data).toMatchObject({ trip_id: null, student_id: null });
  });
});
