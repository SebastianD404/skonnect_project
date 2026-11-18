import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  buildReportDataset: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/auth", () => ({ ensureProfile: mocks.ensureProfile }));
vi.mock("@/lib/report-dataset", () => ({
  buildReportDataset: mocks.buildReportDataset,
  isReportKey: (value: string) => value === "full_kk_census" || value === "demographic_distribution",
  ReportDatasetError: class ReportDatasetError extends Error {},
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/admin/reports/preview/route";

const dataset = {
  title: "Full KK Census Masterlist",
  columns: [{ header: "Name", key: "name" }],
  rows: Array.from({ length: 25 }, (_, index) => ({ name: `Resident ${index + 1}` })),
  summary: [{ label: "Total Records", value: 25 }, { label: "Male / Female", value: "12 / 13" }],
  totalCount: 25,
};

describe("admin report preview endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "admin-auth-id" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "admin-1", role: "SK_OFFICIAL" });
    mocks.buildReportDataset.mockResolvedValue(dataset);
  });

  it("returns only the first 20 records while preserving full count and metrics", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/admin/reports/preview?type=full_kk_census&filter=all_approved"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.rows).toHaveLength(20);
    expect(payload.totalCount).toBe(25);
    expect(payload.summary).toEqual(dataset.summary);
    expect(payload.rows[0].name).toBe("Resident 1");
    expect(mocks.buildReportDataset).toHaveBeenCalledWith(
      "full_kk_census",
      { filter: "all_approved" },
    );
  });

  it("returns every row for aggregate summary reports", async () => {
    mocks.buildReportDataset.mockResolvedValue({
      ...dataset,
      title: "Demographic Distribution (Gender & Sitio)",
      totalCount: 25,
      grandTotalRow: { sitio: "Grand Total", male: 12, female: 13, total: 25 },
    });

    const response = await GET(
      new NextRequest("http://localhost/api/admin/reports/preview?type=demographic_distribution"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.rows).toHaveLength(25);
    expect(payload.isAggregate).toBe(true);
    expect(payload.grandTotalRow).toEqual({ sitio: "Grand Total", male: 12, female: 13, total: 25 });
  });
});
