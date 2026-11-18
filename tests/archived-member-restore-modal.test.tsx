// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { KKProfilingRegistration } from "@/app/admin/kk-profiling/types";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/app/admin/kk-profiling/AdminKKProfilingFormView", () => ({
  AdminKKProfilingFormView: () => null,
}));

import { ArchivedMemberRowActions } from "@/app/admin/members/records/ArchivedMemberRowActions";

const registration: KKProfilingRegistration = {
  id: "profile-1",
  userId: "user-1",
  fullName: "A very long resident name that should wrap instead of clipping outside the restore dialog",
  email: "resident@example.test",
  address: "Barangay Pico",
  sex: "Female",
  age: 36,
  birthDate: new Date("1990-01-01T00:00:00.000Z"),
  facebook: "",
  contactNumber: "",
  civilStatus: "Single",
  youthClassification: "Student",
  youthAgeGroup: "Young Adult (25–30)",
  workStatus: "",
  educationalBackground: "",
  registeredSKVoter: "Yes",
  votedLastSK: "Yes",
  registeredNationalVoter: "Yes",
  attendedKKAssembly: "Yes",
  submittedAt: new Date("2025-01-01T00:00:00.000Z"),
  archivedReason: "Transferred Residence",
  archivedAt: new Date("2026-11-18T12:00:00.000Z"),
};

describe("Archived KK Youth restore modal", () => {
  it("wraps long names and prevents restoration for residents aged 31 or older", () => {
    render(
      <ArchivedMemberRowActions
        registration={registration}
        onRestored={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: `Restore ${registration.fullName} profile` }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-w-md", "w-full", "overflow-hidden", "border-emerald-600");
    expect(screen.getByRole("heading", { name: "Restore this profile?" })).toBeInTheDocument();
    expect(
      screen.getByText(/This resident is 31\+ years old and exceeds the Katipunan ng Kabataan age bracket/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore profile" })).toBeDisabled();
    expect(screen.getByText(/Previously archived: Transferred Residence/)).toBeInTheDocument();

    const description = screen.getByText((_, element) =>
      element?.tagName === "P" && element.textContent?.includes("active Katipunan ng Kabataan"),
    );
    expect(description).toHaveClass("whitespace-normal", "break-words");
    expect(description.textContent).toContain(registration.fullName);
  });
});
