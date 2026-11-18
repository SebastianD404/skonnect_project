// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RevokedGranteesTable from "@/app/admin/skeap/revoked/RevokedGranteesTable";
import type { RevokedGranteeRecord } from "@/app/admin/skeap/revoked/RevokedScholarInspectionModal";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/skeap/revoked",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/admin/AdminTablePaginationFooter", () => ({ default: () => null }));
vi.mock("@/app/admin/skeap/revoked/RevokedScholarInspectionModal", () => ({
  default: ({ record }: { record: { id: string } | null }) =>
    record ? <div data-testid="revoked-detail">{record.id}</div> : null,
}));
vi.mock("@/app/admin/skeap/revoked/RevocationProofViewer", () => ({
  default: ({ granteeId }: { granteeId: string }) => (
    <div data-testid="proof-viewer">{granteeId}</div>
  ),
}));

const record: RevokedGranteeRecord = {
  id: "grantee-1",
  fullName: "Mira Santos",
  email: "mira@example.com",
  phoneNumber: null,
  sitio: "Purok 1",
  revokedAt: "2026-11-18T00:00:00.000Z",
  reason: "Committed acts unbecoming of a student",
  additionalNotes: null,
  isPermanentlyBarred: false,
  revocationProofPath: "grantee-1/proof.pdf",
  revocationProofType: "Barangay Incident Report",
  revocationProofFileName: "incident.pdf",
  revocationProofHash: "a".repeat(64),
  revokedBy: null,
  school: "Pico National High School",
  yearLevel: "Grade 12",
  kkProfile: null,
  application: null,
  submissions: [],
};

describe("RevokedGranteesTable actions", () => {
  it("uses aligned horizontal actions and the View label in the table", () => {
    const { container } = render(
      <RevokedGranteesTable
        records={[record]}
        query=""
        page={1}
        pageSize={10}
        totalCount={1}
      />,
    );
    const table = screen.getByRole("table");
    const row = within(table).getByRole("row", { name: /Mira Santos/ });
    const actionHeader = within(table).getByRole("columnheader", { name: "Actions" });
    const actionCell = row.querySelector("td:last-child");

    expect(actionHeader).toHaveClass("text-right", "whitespace-nowrap", "align-middle");
    expect(actionCell).toHaveClass("text-right", "whitespace-nowrap", "align-middle");
    expect(container.querySelectorAll("table tbody td.align-middle")).toHaveLength(6);
    expect(actionCell?.querySelector("div")).toHaveClass(
      "inline-flex",
      "items-center",
      "justify-end",
      "gap-2",
      "whitespace-nowrap",
    );

    const viewButton = within(table).getByRole("button", {
      name: "View revocation details for Mira Santos",
    });
    expect(viewButton).toHaveTextContent("View");
    expect(within(table).queryByRole("button", { name: "View Proof" })).not.toBeInTheDocument();

    fireEvent.click(
      within(table).getByRole("button", { name: "Barangay Incident Report" }),
    );
    expect(screen.getByTestId("proof-viewer")).toHaveTextContent("grantee-1");
    expect(screen.queryByTestId("revoked-detail")).not.toBeInTheDocument();
  });
});
