const INDIAN_MOBILE_RE = /^(?:\+91|91|0)?([6-9]\d{9})$/;

/**
 * Pure. Accepts common input variations (with/without +91, 91, or a leading 0, with or without
 * spaces/hyphens/parens) and normalizes to the canonical +91XXXXXXXXXX form. Returns null if the
 * input isn't a valid 10-digit Indian mobile number.
 */
export function normalizeIndianPhone(raw: string): string | null {
  const stripped = raw.replace(/[\s\-()]/g, "");
  const match = INDIAN_MOBILE_RE.exec(stripped);
  if (!match) return null;
  return `+91${match[1]}`;
}
