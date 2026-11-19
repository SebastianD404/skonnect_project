import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  getExportButtonLabel,
  getPlatformAccountExportCohort,
} from "@/lib/platform-account-export";

describe("platform account export cohort labels", () => {
  it("uses the active role for button labels and filename slugs", () => {
    expect(
      getExportButtonLabel({
        count: 1064,
        metric: "all",
        role: Role.YOUTH,
        searchQuery: "",
      }),
    ).toBe(`Export Youth (${(1064).toLocaleString()})`);
    expect(getPlatformAccountExportCohort("all", Role.SK_OFFICIAL).slug)
      .toBe("sk-officials");
  });

  it("maps KPI filters to their cohort label and slug", () => {
    expect(
      getExportButtonLabel({
        count: 12,
        metric: "pending",
        role: null,
        searchQuery: "",
      }),
    ).toBe("Export Pending (12)");
    expect(getPlatformAccountExportCohort("adminStaff", null).slug).toBe("privileged");
    expect(getPlatformAccountExportCohort("archived", null).slug).toBe("archived");
  });

  it("adds a matching label for searches, with the cohort when selected", () => {
    expect(
      getExportButtonLabel({
        count: 3,
        metric: "all",
        role: null,
        searchQuery: "  Alex  ",
      }),
    ).toBe("Export Matching (3)");
    expect(
      getExportButtonLabel({
        count: 3,
        metric: "all",
        role: Role.SUPER_ADMIN,
        searchQuery: "Alex",
      }),
    ).toBe("Export Matching Super Admins (3)");
  });
});
