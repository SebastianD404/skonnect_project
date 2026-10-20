const FAILING_GRADE_INDICATORS = /\b(?:5\.00?|INC|DRP|DROP|FAILED|7[0-4](?:\.\d{1,2})?)\b/i;

export function hasFailingGradeIndicators(text: string): boolean {
  return FAILING_GRADE_INDICATORS.test(text);
}
