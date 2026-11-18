// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { KKProfilingRegistration } from "@/app/admin/kk-profiling/types";

const mocks = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/members/records",
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/admin/AdminExportButton", () => ({ default: () => null }));
vi.mock("@/app/admin/members/records/ArchivedMemberRowActions", () => ({
  ArchivedMemberRowActions: () => null,
}));

import { ArchivedMembersTable } from "@/app/admin/members/records/ArchivedMembersTable";

const archivedAt = new Date("2026-11-18T12:00:00.000Z");
const sharedRecord = {
  submittedAt: new Date("2025-01-01T00:00:00.000Z"),
  archivedAt,
  birthDate: new Date("1995-01-01T00:00:00.000Z"),
  youthAgeGroup: "Aged Out (31+)",
  youthClassification: "Student",
  registeredSKVoter: "Yes",
} as const;

const records = [
  {
    ...sharedRecord,
    id: "aged-out",
    fullName: "Aged Out Resident",
    email: "aged-out@example.test",
    archivedReason: "Aged out (31+ years old - RA 10742)",
  },
  {
    ...sharedRecord,
    id: "admin-archived",
    fullName: "Admin Archived Resident",
    email: "admin-archived@example.test",
    archivedReason: "Transferred Residence",
  },
  {
    ...sharedRecord,
    id: "deceased",
    fullName: "Deceased Resident",
    email: "deceased@example.test",
    archivedReason: "Deceased",
  },
  {
    ...sharedRecord,
    id: "custom",
    fullName: "Custom Reason Resident",
    email: "custom@example.test",
    archivedReason: "Other: Relocated outside the region",
  },
] as unknown as KKProfilingRegistration[];

describe("Archived KK Youth table", () => {
  it("shows concise archive metadata and demographic age groups without horizontal scrolling", () => {
    render(<ArchivedMembersTable records={records} initialQuery="" totalCount={2} />);

    expect(screen.getAllByText("Aged Out (31+)")).toHaveLength(2);
    expect(screen.getAllByText("Over 30 (31 yrs)")).toHaveLength(8);
    expect(screen.queryByText(/RA 10742/)).not.toBeInTheDocument();
    expect(screen.queryByText("Reason not recorded")).not.toBeInTheDocument();
    expect(screen.getAllByText("Transferred Residence")).toHaveLength(2);
    expect(screen.getAllByText("Deceased")).toHaveLength(2);
    expect(screen.getAllByText("Other: Relocated outside the region")).toHaveLength(2);
    expect(screen.getAllByText(/Archived .*2026/)).toHaveLength(8);

    const table = screen.getByRole("table");
    expect(table).toHaveClass("table-fixed");
    expect(table.parentElement).not.toHaveClass("overflow-x-auto");
  });
});
