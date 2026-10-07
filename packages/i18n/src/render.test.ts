import { describe, expect, it } from 'vitest';
import ar from './ar.json';
import en from './en.json';
import { formatDate, formatTime, isolate } from './format';
import { renderNotification } from './render';

const params = {
  child_en: 'Sara',
  child_ar: 'سارة',
  bus_en: 'Bus 12',
  bus_ar: 'حافلة 12',
  time_iso: '2030-01-07T11:07:00Z',
};

describe('formatTime', () => {
  it('formats English in Asia/Dubai', () => {
    expect(formatTime('2030-01-07T11:07:00Z', 'en')).toBe('3:07 PM');
  });
  it('formats Arabic with م and Western digits', () => {
    const s = formatTime('2030-01-07T11:07:00Z', 'ar');
    expect(s).toContain('3:07');
    expect(s).toContain('م');
    expect(/[٠-٩]/.test(s)).toBe(false);
  });
  it('uses ص in the morning', () => {
    expect(formatTime('2030-01-07T03:05:00Z', 'ar')).toContain('ص');
  });
});

describe('formatDate', () => {
  it('uses Western digits in both languages', () => {
    expect(/[٠-٩]/.test(formatDate('2030-01-07T11:07:00Z', 'ar'))).toBe(false);
    expect(formatDate('2030-01-07T11:07:00Z', 'en')).toContain('7');
  });
});

describe('isolate', () => {
  it('wraps in FSI and PDI', () => {
    expect(isolate('x')).toBe('⁨x⁩');
  });
});

describe('renderNotification', () => {
  it('renders the English boarded template', () => {
    expect(renderNotification(en, 'boarded', 'en', params)).toEqual({
      title: 'Sara is on the bus',
      body: 'Boarded Bus 12 at 3:07 PM. Tap to track.',
    });
  });

  it('renders Arabic with isolated values', () => {
    const r = renderNotification(ar, 'picked_up', 'ar', params);
    expect(r.title).toBe('تم اصطحاب ⁨سارة⁩');
    expect(r.body).toContain('⁨حافلة 12⁩');
    expect(r.body).toContain(`⁨${formatTime(params.time_iso, 'ar')}⁩`);
  });

  it('falls back to the other language name', () => {
    const r = renderNotification(ar, 'dropped', 'ar', {
      child_en: 'Omar',
      stop_en: 'Al Barsha',
      time_iso: params.time_iso,
    });
    expect(r.title).toBe('تم إنزال ⁨Omar⁩');
    expect(r.body).toContain('⁨Al Barsha⁩');
  });

  it('does not isolate names', () => {
    const r = renderNotification(ar, 'roll_call_missing', 'ar', {
      bus_ar: 'حافلة 12',
      count: 2,
      names_ar: 'سارة، عمر',
    });
    expect(r.body).toBe('سارة، عمر');
    expect(r.title).toContain('⁨2⁩');
  });

  it('renders minutes, reason and count', () => {
    expect(
      renderNotification(en, 'trip_forced_end', 'en', { bus_en: 'Bus 3', count: 2, reason: 'Breakdown' }),
    ).toEqual({ title: 'Bus 3 ended the trip with 2 unaccounted', body: 'Reason: Breakdown' });
    expect(renderNotification(en, 'stationary', 'en', { bus_en: 'Bus 3', minutes: 7 }).title).toBe(
      'Bus 3 has not moved for 7 min',
    );
  });

  it('renders every template in both languages without leftover placeholders', () => {
    const types = Object.keys((en as { notif: Record<string, unknown> }).notif);
    for (const type of types) {
      for (const locale of ['en', 'ar'] as const) {
        const r = renderNotification(locale === 'en' ? en : ar, type, locale, {
          ...params,
          stop_en: 'Stop',
          names_en: 'A, B',
          minutes: 5,
          count: 1,
          reason: 'x',
        });
        expect(r.title + r.body).not.toContain('{{');
      }
    }
  });

  it('throws for an unknown type', () => {
    expect(() => renderNotification(en, 'nope', 'en', {})).toThrow();
  });
});
