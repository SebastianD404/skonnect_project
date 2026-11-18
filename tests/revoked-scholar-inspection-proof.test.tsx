// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RevokedScholarInspectionModal, {
  type RevokedGranteeRecord,
} from "@/app/admin/skeap/revoked/RevokedScholarInspectionModal";

vi.mock("@/components/SkeapApplicationFormModal", () => ({ default: () => null }));
vi.mock("@/lib/skeap-upload", () => ({
  getAdditionalUploadGroups: () => [],
  getCoreUploadGroups: () => [],
  getPhotoUploadGroup: () => null,
}));

const record: RevokedGranteeRecord = {
  id: "grantee-1",
  fullName: "Mira Santos",
  email: "mira@example.com",
  phoneNumber: null,
  sitio: "Purok 1",
  revokedAt: "2026-11-18T00:00:00.000Z",
  reason: "Committed acts unbecoming of a student",
  additionalNotes: "Incident summary",
  isPermanentlyBarred: false,
  revocationProofPath: "grantee-1/proof.pdf",
  revocationProofType: "Barangay Incident Report",
  revocationProofFileName: "incident-report.pdf",
  revocationProofHash: "a".repeat(64),
  revokedBy: null,
  school: "Pico National High School",
  yearLevel: "Grade 12",
  kkProfile: null,
  application: null,
  submissions: [],
};

describe("RevokedScholarInspectionModal supporting proof", () => {
  it("shows proof metadata and opens the signed-url viewer from the details modal", () => {
    const onViewProof = vi.fn();

    render(
      <RevokedScholarInspectionModal
        record={record}
        onClose={vi.fn()}
        onViewProof={onViewProof}
      />,
    );

    expect(screen.getByText("Supporting Proof Document")).toBeInTheDocument();
    expect(screen.getByText("Barangay Incident Report")).toBeInTheDocument();
    expect(screen.getByText("incident-report.pdf")).toBeInTheDocument();
    expect(
      screen.getByText(`SHA-256 · ${"a".repeat(12)}…`),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View Document" }));
    expect(onViewProof).toHaveBeenCalledWith("grantee-1");
  });
});
