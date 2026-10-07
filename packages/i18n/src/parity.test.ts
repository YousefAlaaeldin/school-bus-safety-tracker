import { describe, expect, it } from 'vitest';
import en from './en.json';
import ar from './ar.json';

function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      Object.assign(out, flatten(value as Record<string, unknown>, path));
    } else {
      out[path] = String(value);
    }
  }
  return out;
}

function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1] ?? ''))].sort();
}

const flatEn = flatten(en);
const flatAr = flatten(ar);

describe('i18n parity', () => {
  it('has identical key sets', () => {
    expect(Object.keys(flatAr).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it('has identical placeholders for every key', () => {
    for (const key of Object.keys(flatEn)) {
      expect(placeholders(flatAr[key] ?? ''), key).toEqual(placeholders(flatEn[key] ?? ''));
    }
  });
});
