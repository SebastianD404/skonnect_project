import { describe, expect, it } from "vitest";
import { createCsvResponse, parseReportDateRange, parseReportFormat } from "@/lib/report-export";

describe("report export parameters", () => {
  it("defaults the format to xlsx and rejects unsupported formats", () => {
    expect(parseReportFormat(null)).toBe("xlsx");
    expect(parseReportFormat("csv")).toBe("csv");
    expect(parseReportFormat("pdf")).toBeNull();
  });

  it("validates calendar dates and makes the end date inclusive", () => {
    const range = parseReportDateRange(new URLSearchParams({
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    }));

    expect(range.error).toBeNull();
    expect(range.startDate?.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(range.endDateExclusive?.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(parseReportDateRange(new URLSearchParams({ startDate: "2026-02-30" })).error)
      .toBe("Dates must use the YYYY-MM-DD format.");
    expect(parseReportDateRange(new URLSearchParams({
      startDate: "2026-03-02",
      endDate: "2026-03-01",
    })).error).toBe("Start Date cannot be after End Date.");
  });

  it("escapes CSV cells and protects spreadsheet formula-like values", async () => {
    const response = createCsvResponse(
      [{ name: '=HYPERLINK("https://example.test")', note: "said \"hello\"" }],
      [
        { header: "Name", key: "name" },
        { header: "Note", key: "note" },
      ],
      "sample.xlsx",
    );

    expect(response.headers.get("Content-Disposition")).toContain("sample.csv");
    const csv = await response.text();
    expect(csv).toContain(`"'=HYPERLINK(""https://example.test"")"`);
    expect(csv).toContain(`"said ""hello"""`);
  });
});
