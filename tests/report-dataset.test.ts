import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ memberQuery: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: mocks.memberQuery },
  hasGranteeRetentionColumn: vi.fn(),
}));

import { buildReportDataset } from "@/lib/report-dataset";

describe("buildReportDataset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the export column definitions and computes summaries from the full KK dataset", async () => {
    mocks.memberQuery.mockResolvedValue([
      {
        fullName: "Resident One",
        email: "one@example.com",
        contactNumber: "555-0101",
        age: 20,
        youthAgeGroup: "Core Youth (18–24)",
        youthClassification: "In school Youth",
        workStatus: "Student",
        registeredSKVoter: "Yes",
        reviewStatus: "Approved",
        submittedAt: new Date("2026-01-01T00:00:00.000Z"),
        sex: "Male",
      },
      {
        fullName: "Resident Two",
        email: "two@example.com",
        contactNumber: "555-0102",
        age: 21,
        youthAgeGroup: "Core Youth (18–24)",
        youthClassification: "Out of School Youth",
        workStatus: "Working",
        registeredSKVoter: "No",
        reviewStatus: "Approved",
        submittedAt: new Date("2026-01-02T00:00:00.000Z"),
        sex: "Female",
      },
    ]);

    const dataset = await buildReportDataset("full_kk_census", { filter: "all_approved" });

    expect(dataset.title).toBe("Full KK Census Masterlist");
    expect(dataset.columns.map(({ header }) => header)).toEqual([
      "Name",
      "Email",
      "Contact Number",
      "Age",
      "Age Group",
      "Classification",
      "Work Status",
      "SK Voter",
      "Status",
      "Submitted Date",
    ]);
    expect(dataset.rows).toHaveLength(2);
    expect(dataset.totalCount).toBe(2);
    expect(dataset.summary).toEqual([
      { label: "Total Records", value: 2 },
      { label: "In-School Youth", value: 1 },
      { label: "Male / Female", value: "1 / 1" },
    ]);
  });
});
