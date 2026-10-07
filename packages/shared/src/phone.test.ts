import { describe, expect, it } from 'vitest';
import { isUaeMobile, normalizeUaePhone } from './phone';

describe('normalizeUaePhone', () => {
  const cases: [string, string | null][] = [
    ['050 123 4567', '+971501234567'],
    ['00971501234567', '+971501234567'],
    ['971501234567', '+971501234567'],
    ['+971-50-123-4567', '+971501234567'],
    ['(050) 123-4567', '+971501234567'],
    ['+971501234567', '+971501234567'],
    ['+447700900123', '+447700900123'],
    ['abc', null],
    ['', null],
    ['12345', null],
    ['447700900123', null],
  ];
  it.each(cases)('%j -> %j', (input, expected) => {
    expect(normalizeUaePhone(input)).toBe(expected);
  });
});

describe('isUaeMobile', () => {
  it('accepts +9715 plus 8 digits', () => {
    expect(isUaeMobile('+971501234567')).toBe(true);
  });
  it('rejects others', () => {
    expect(isUaeMobile('+97141234567')).toBe(false);
    expect(isUaeMobile('+447700900123')).toBe(false);
    expect(isUaeMobile('0501234567')).toBe(false);
  });
});
