// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import GraduationAction from "@/app/admin/grantees/[id]/GraduationAction";

describe("GraduationAction online review mode", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ pendingPayoutHold: false, pendingComplianceCount: 0 }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows the uploaded document and omits the physical-upload path", async () => {
    render(
      <GraduationAction
        granteeId="grantee-1"
        granteeName="Mira Santos"
        exitClearanceUrl="grantee-clearances/mira/clearance.pdf"
        exitClearanceFileName="clearance.pdf"
        exitClearanceSubmittedAt="2026-11-18T00:00:00.000Z"
        onlineReview
        initiallyOpen
        hideTrigger
      />,
    );

    expect(screen.getByText("clearance.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Clearance" })).toBeInTheDocument();
    expect(screen.queryByText(/No online clearance has been uploaded/)).not.toBeInTheDocument();
    expect(screen.queryByText("Optional on-site clearance scan")).not.toBeInTheDocument();
    await screen.findByText("No pending financial payout holds detected");
  });

  it("keeps the online document card visible when a submitted record has no file URL", () => {
    render(
      <GraduationAction
        granteeId="grantee-2"
        granteeName="Noah Reyes"
        exitClearanceUrl={null}
        exitClearanceFileName={null}
        exitClearanceSubmittedAt={null}
        onlineReview
        initiallyOpen
        hideTrigger
      />,
    );

    expect(screen.getByText("Exit Clearance document unavailable")).toBeInTheDocument();
    expect(screen.getByText("No uploaded document is attached to this submission.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Clearance" })).toBeDisabled();
    expect(screen.queryByText(/No online clearance has been uploaded/)).not.toBeInTheDocument();
  });
});
