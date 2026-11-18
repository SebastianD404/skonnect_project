import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  buildReportDataset: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/auth", () => ({ ensureProfile: mocks.ensureProfile }));
vi.mock("@/lib/audit/logger", () => ({ logAuditEvent: mocks.logAuditEvent }));
vi.mock("@/lib/report-dataset", () => ({
  buildReportDataset: mocks.buildReportDataset,
  isReportKey: (value: string) => value === "full_kk_census",
  ReportDatasetError: class ReportDatasetError extends Error {},
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/admin/reports/export/route";

describe("admin report export endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "admin-auth-id" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "admin-1", email: "admin@example.com", role: "SK_OFFICIAL" });
    mocks.logAuditEvent.mockResolvedValue(undefined);
    mocks.buildReportDataset.mockResolvedValue({
      title: "Full KK Census Masterlist",
      columns: [{ header: "Name", key: "name", width: 30 }],
      rows: [{ name: "Resident One" }],
      summary: [{ label: "Total Records", value: 1 }],
      totalCount: 1,
    });
  });

  it("uses the shared report dataset for the downloadable workbook", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/admin/reports/export?type=full_kk_census&filter=all_approved"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
    expect(response.headers.get("Content-Disposition")).toContain("full-kk-census-masterlist");
    expect(mocks.buildReportDataset).toHaveBeenCalledWith(
      "full_kk_census",
      { filter: "all_approved" },
    );
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "admin-1",
      metadata: expect.objectContaining({ reportKey: "full_kk_census", recordCount: 1 }),
    }));
    expect(await response.arrayBuffer()).toBeInstanceOf(ArrayBuffer);
  });
});
