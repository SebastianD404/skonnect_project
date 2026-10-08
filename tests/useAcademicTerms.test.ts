import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAcademicTerms } from "../lib/useAcademicTerms";
import { getDocumentSemesterOptions } from "../lib/semester-progress";

describe("generateAcademicTerms", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the shared current semester during the January-to-May academic year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 15));

    const terms = generateAcademicTerms({
      years: [
        { startYear: 2024, terms: 2 },
        { startYear: 2025, terms: 2 },
        { startYear: 2026, terms: 2 },
      ],
    });

    expect(terms.some((term) => term.startYear === 2027)).toBe(false);
    expect(terms.map((term) => term.label)).toContain("2025-2026 Second Semester (current)");
  });

  it("labels the current document term and excludes Summer", () => {
    const options = getDocumentSemesterOptions(
      ["2025-2026 Summer Term", "2024-2025 First Semester"],
      new Date(2026, 1, 15)
    );

    expect(options.map((option) => option.label)).toContain(
      "2025-2026 Second Semester (Current)"
    );
    expect(options.some((option) => /summer/i.test(option.label))).toBe(false);
  });
});
