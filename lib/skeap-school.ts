const KCP_SCHOOL_PATTERN = /^king['’]s college of the philippines(?:\s*\(kcp\))?$/i;

export function normalizeSkeapSchoolName(value: string | null | undefined): string {
  if (value == null) return "";

  const trimmedValue = value.trim();
  return KCP_SCHOOL_PATTERN.test(trimmedValue)
    ? "King's College of the Philippines"
    : value;
}
