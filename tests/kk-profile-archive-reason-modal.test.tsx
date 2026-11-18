// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { KKProfilingRegistration } from "@/app/admin/kk-profiling/types";

import { KKProfilingRowActions } from "@/app/admin/kk-profiling/KKProfilingRowActions";

const registration: KKProfilingRegistration = {
  id: "registration-1",
  fullName: "Resident Name",
  email: "resident@example.com",
  address: "Barangay Pico",
  sex: "Female",
  age: 24,
  birthDate: new Date("2002-01-01T00:00:00.000Z"),
  facebook: "",
  contactNumber: "",
  civilStatus: "Single",
  youthClassification: "Student",
  youthAgeGroup: "Core Youth",
  workStatus: "Not working",
  educationalBackground: "College",
  registeredSKVoter: "Yes",
  votedLastSK: "Yes",
  registeredNationalVoter: "Yes",
  attendedKKAssembly: "No",
  submittedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("KK profile archive reason dialog", () => {
  it("reveals required custom reason input and updates the notification preview", () => {
    render(
      <KKProfilingRowActions
        registration={registration}
        onArchive={vi.fn()}
        onUpdate={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Archive profile" }));
    const dialog = screen.getByRole("dialog");
    const select = within(dialog).getByLabelText("Archive reason");
    const archiveButton = within(dialog).getByRole("button", { name: "Archive profile" });
    expect(archiveButton).toBeDisabled();

    fireEvent.change(select, { target: { value: "Deceased" } });
    expect(within(dialog).getByText(
      "Vital status record update for SK audit history. No email or in-app notification will be sent to this account.",
    )).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "Other (Specify)" } });
    const customReason = within(dialog).getByPlaceholderText("Specify archive reason...");
    expect(customReason).toHaveAttribute("maxLength", "120");
    expect(customReason).toBeRequired();
    expect(archiveButton).toBeDisabled();

    fireEvent.change(customReason, { target: { value: "Reason for archival" } });
    expect(archiveButton).toBeEnabled();
    expect(within(dialog).getByText(
      "Custom administrative archive reason. An automated notice will be sent to their SKonnect account and email.",
    )).toBeInTheDocument();
  });
});
