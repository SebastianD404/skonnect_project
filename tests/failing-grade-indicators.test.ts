import { describe, expect, it } from "vitest";
import { hasFailingGradeIndicators } from "@/lib/ocr/failing-grade-indicators";
import { parseVerifiedGwa } from "@/lib/grade-report-review";

describe("failing grade indicator detection", () => {
  it.each(["Final Grade: 5.0", "5.00", "INC", "DRP", "DROP", "FAILED", "74.5"])(
    "detects %s",
    (text) => {
      expect(hasFailingGradeIndicators(text)).toBe(true);
    }
  );

  it.each(["3 units, grade 1.25", "75", "PASSED", "INCOMPLETE"])(
    "does not flag %s",
    (text) => {
      expect(hasFailingGradeIndicators(text)).toBe(false);
    }
  );
});

describe("verified GWA validation", () => {
  it.each([
    ["1.25", 1.25],
    ["1,50", 1.5],
    ["3", 3],
    ["92", 92],
    ["100", 100],
  ])("accepts %s", (value, expected) => {
    expect(parseVerifiedGwa(value)).toBe(expected);
  });

  it.each(["0.99", "3.01", "74.99", "101", "1.234", "abc"])(
    "rejects %s",
    (value) => {
      expect(parseVerifiedGwa(value)).toBeNull();
    }
  );
});
