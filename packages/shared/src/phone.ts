/**
 * Normalises a UAE-style phone number to E.164. Same rules as `private.normalize_phone` in SQL:
 * strip spaces, dashes and brackets; `00…` → `+…`; `05XXXXXXXX` → `+9715XXXXXXXX`;
 * `9715…` → `+9715…`. Returns null unless the result matches `^\+[1-9][0-9]{7,14}$`.
 */
export function normalizeUaePhone(input: string): string | null {
  if (typeof input !== 'string') return null;
  let v = input.replace(/[\s\-()]/g, '');
  if (v.startsWith('00')) {
    v = `+${v.slice(2)}`;
  } else if (/^05[0-9]{8}$/.test(v)) {
    v = `+971${v.slice(1)}`;
  } else if (v.startsWith('9715')) {
    v = `+${v}`;
  }
  return /^\+[1-9][0-9]{7,14}$/.test(v) ? v : null;
}

/** True for a UAE mobile number in E.164: +9715 followed by 8 digits. */
export function isUaeMobile(e164: string): boolean {
  return /^\+9715[0-9]{8}$/.test(e164);
}
