export function parseVerifiedGwa(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(normalized)) return null;

  const gwa = Number(normalized);
  return (gwa >= 1 && gwa <= 3) || (gwa >= 75 && gwa <= 100) ? gwa : null;
}
