import { describe, expect, it } from "vitest";
import { getAuditActionSummary, getAuditChanges } from "../lib/audit/metadata";

describe("OCR override audit presentation", () => {
  it("shows a clean action summary", () => {
    expect(
      getAuditActionSummary({
        action: "ADMIN_OCR_OVERRIDE",
        targetId: "submission-123",
        metadata: { summary: "Admin manually verified corrected OCR grade rows." },
      })
    ).toBe("Admin manually verified corrected OCR grade rows.");
  });

  it("formats nested grade rows as readable JSON for the clamped audit detail table", () => {
    expect(
      getAuditChanges({
        action: "ADMIN_OCR_OVERRIDE",
        targetId: "submission-123",
        beforeData: { ocrParsedRows: { rows: [{ subjectName: "Mathematics", grade: 1.25 }] } },
        afterData: { ocrParsedRows: { rows: [{ subjectName: "Mathematics", grade: 1.5 }] } },
      })
    ).toEqual([
      {
        field: "ocrParsedRows",
        before: '{\n  "rows": [\n    {\n      "subjectName": "Mathematics",\n      "grade": 1.25\n    }\n  ]\n}',
        after: '{\n  "rows": [\n    {\n      "subjectName": "Mathematics",\n      "grade": 1.5\n    }\n  ]\n}',
      },
    ]);
  });
});
