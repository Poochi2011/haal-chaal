/** Normalise a phone number typed by a family member to E.164 (assumes India if no country code). */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+\d{10,15}$/.test(digits)) return digits;
  const d = digits.replace(/^\+/, "");
  if (/^0?[6-9]\d{9}$/.test(d)) return "+91" + d.slice(-10);
  if (/^91[6-9]\d{9}$/.test(d)) return "+" + d;
  return null;
}
