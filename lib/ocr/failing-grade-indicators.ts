const FAILING_STATUS = /\b(?:FAILED|FAIL|NFE|INC|DRP|DROP)\b/i;
const NUMERIC_TOKEN = /(?<![A-Z0-9])\d+(?:[.,]\d+)?(?![A-Z0-9])/gi;

function isFailingGradeValue(value: number) {
  return value === 5 || value < 1 || (value >= 50 && value < 75);
}

export function hasFailingGradeIndicators(text: string): boolean {
  return text.split(/\r?\n/).some((line) => {
    if (FAILING_STATUS.test(line)) return true;

    const values = [...line.matchAll(NUMERIC_TOKEN)].map((match) =>
      Number(match[0].replace(",", "."))
    );
    if (values.length === 0) return false;

    const gradeLabel = line.match(/\b(?:final\s+)?grade\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i);
    const candidate = gradeLabel
      ? Number(gradeLabel[1].replace(",", "."))
      : values.length > 1
        ? values[values.length - 1]
        : /^\s*\d+(?:[.,]\d+)?\s*$/.test(line)
          ? values[0]
          : null;

    return candidate !== null && isFailingGradeValue(candidate);
  });
}
