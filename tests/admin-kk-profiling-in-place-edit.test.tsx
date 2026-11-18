// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KKProfilingRegistration } from "@/app/admin/kk-profiling/types";

vi.mock("@/app/admin/kk-profiling/actions", () => ({
  rejectKKProfilingApplication: vi.fn(),
}));

import { AdminKKProfilingFormView } from "@/app/admin/kk-profiling/AdminKKProfilingFormView";

const registration = {
  id: "registration-1",
  submittedAt: new Date("2026-01-01T00:00:00.000Z"),
  reviewStatus: "Approved",
  fullName: "Example Resident",
  birthDate: new Date("2000-01-01T00:00:00.000Z"),
  sex: "Female",
  age: 26,
  address: "Example Address",
  contactNumber: "555-0100",
  youthClassification: "Student",
  registeredSKVoter: "Yes",
  kkProfile: {
    fullName: "Example Resident",
    birthDate: new Date("2000-01-01T00:00:00.000Z"),
    sex: "FEMALE",
    purok: "Purok 1",
  },
} as unknown as KKProfilingRegistration;

describe("AdminKKProfilingFormView in-place profile editing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the submission layout and shows the live age-out notice while editing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => registration,
      }),
    );

    render(
      <AdminKKProfilingFormView
        registration={registration}
        onClose={vi.fn()}
        editInView
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Edit Profile" }));

    expect(
      screen.getByRole("heading", { name: "Katipunan ng Kabataan (KK) Profiling — Submission" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PART I: Profile" })).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);

    fireEvent.change(document.querySelector('input[type="date"]')!, {
      target: { value: "1980-01-01" },
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Age-Out Notice (31+ yrs old): Exceeds the Katipunan ng Kabataan age limit (15–30 under RA 10742). Saving will automatically archive this profile and move it to Archived KK Youth.",
      );
    });
    expect(screen.getByText(/46 yrs old/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Edit Profile" })).toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });
});
