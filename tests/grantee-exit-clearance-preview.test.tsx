// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import ExitClearanceSubmission from "@/app/grantee-dashboard/ExitClearanceSubmission";

let createObjectUrlDescriptor: PropertyDescriptor | undefined;
let revokeObjectUrlDescriptor: PropertyDescriptor | undefined;

describe("ExitClearanceSubmission image preview", () => {
  beforeEach(() => {
    createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:local-clearance-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    if (createObjectUrlDescriptor) {
      Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
    } else {
      Reflect.deleteProperty(URL, "createObjectURL");
    }
    if (revokeObjectUrlDescriptor) {
      Object.defineProperty(URL, "revokeObjectURL", revokeObjectUrlDescriptor);
    } else {
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }
    vi.restoreAllMocks();
  });

  it("does not render an image with an empty src while the local object URL is being created", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <ExitClearanceSubmission
        initialStatus="NONE"
        initialUrl={null}
        initialRemarks={null}
        initialFileName={null}
        initialSubmittedAt={null}
        isDueForGraduation={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Exit Clearance/ }));
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("Expected the exit-clearance upload input to be rendered.");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["image data"], "certificate.png", { type: "image/png" })],
      },
    });

    await waitFor(() => {
      expect(
        container.querySelector('img[alt="Preview of certificate.png"]'),
      ).toHaveAttribute("src", "blob:local-clearance-preview");
    });
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
      'An empty string ("") was passed to the src attribute',
    );
  });

  it("shows returned feedback and replaces the saved file with a local preview", async () => {
    const { container } = render(
      <ExitClearanceSubmission
        initialStatus="RETURNED"
        initialUrl="/api/private-documents/grantee-clearances/scholar/previous-clearance.pdf"
        initialRemarks="Please upload a clearer scan."
        initialFileName="previous-clearance.pdf"
        initialSubmittedAt="2026-04-04T00:00:00.000Z"
        isDueForGraduation
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Exit Clearance/ }));

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("SK Admin note: Please upload a clearer scan.")).toBeInTheDocument();
    const returnedPill = dialog.getByText("Returned · Action Required");
    const returnedCallout = returnedPill.closest("div.rounded-xl");
    expect(returnedCallout).toHaveClass("border-rose-200/80", "bg-rose-50/50");
    expect(dialog.getByRole("button", { name: "Replace" })).toHaveClass("bg-[#0C2D48]");
    expect(dialog.getByRole("button", { name: "View clearance" })).toBeInTheDocument();

    fireEvent.click(dialog.getByRole("button", { name: "Replace" }));
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("Expected the exit-clearance upload input to be rendered.");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["%PDF-1.7 replacement"], "replacement.pdf", { type: "application/pdf" })],
      },
    });

    await waitFor(() => {
      expect(dialog.getByRole("button", { name: "Preview replacement.pdf" })).toBeInTheDocument();
    });
    expect(dialog.queryByRole("button", { name: "View clearance" })).not.toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Remove file" })).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Resubmit Exit Clearance" })).toBeEnabled();

    fireEvent.click(dialog.getByRole("button", { name: "Remove file" }));

    expect(dialog.getByRole("button", { name: "View clearance" })).toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: "Resubmit Exit Clearance" })).not.toBeInTheDocument();
  });

  it("uses the submitted surface and secondary replace action only for pending submissions", () => {
    render(
      <ExitClearanceSubmission
        initialStatus="SUBMITTED"
        initialUrl="/api/private-documents/grantee-clearances/scholar/clearance.pdf"
        initialRemarks={null}
        initialFileName="clearance.pdf"
        initialSubmittedAt="2026-04-04T00:00:00.000Z"
        isDueForGraduation={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Exit Clearance/ }));

    const dialog = within(screen.getByRole("dialog"));
    const submittedPill = dialog.getByText("Submitted · Pending SK Verification");
    expect(submittedPill).toHaveClass("border-teal-200/80", "bg-teal-50/70");
    expect(dialog.getByRole("button", { name: "Replace" })).toHaveClass(
      "border-slate-200",
      "bg-white",
    );
    expect(dialog.queryByRole("button", { name: "Replace File" })).not.toBeInTheDocument();
  });
});
