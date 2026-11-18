// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExitClearancesPageClient, {
  type ExitClearanceRow,
} from "@/app/admin/exit-clearances/ExitClearancesPageClient";

const grantees: ExitClearanceRow[] = [
  {
    id: "submitted-1",
    fullName: "Mira Santos",
    email: "mira@example.com",
    school: "Pico National High School",
    yearLevel: "Grade 12",
    exitClearanceStatus: "SUBMITTED",
    exitClearanceUrl: "grantee-clearances/mira/clearance.pdf",
    exitClearanceFileName: "clearance.pdf",
    exitClearanceSubmittedAt: "2026-04-04T00:00:00.000Z",
  },
  {
    id: "uploaded-1",
    fullName: "Ari Alvarez",
    email: "ari@example.com",
    school: "Pico National High School",
    yearLevel: "Grade 12",
    exitClearanceStatus: null,
    exitClearanceUrl: "grantee-clearances/ari/clearance.pdf",
    exitClearanceFileName: null,
    exitClearanceSubmittedAt: null,
  },
];

describe("ExitClearancesPageClient", () => {
  it("includes submitted records and URL-backed files even if their status is null", () => {
    render(<ExitClearancesPageClient grantees={grantees} />);

    expect(screen.getByText("Mira Santos")).toBeInTheDocument();
    expect(screen.getByText("Ari Alvarez")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Walk-In" })).not.toBeInTheDocument();
    const reviewButtons = screen.getAllByRole("button", { name: "Review" });
    expect(reviewButtons).toHaveLength(2);
    expect(reviewButtons[0]).toHaveAttribute("title", "Verify Exit Clearance & Graduate Scholar");
    expect(screen.getByText("MS")).toBeInTheDocument();
    expect(screen.getByText("AA")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Clearance Document" })).toBeInTheDocument();
    const statusLabels = screen.getAllByText("Clearance Submitted");
    expect(statusLabels).toHaveLength(2);
    expect(statusLabels[0]).toHaveClass("w-fit", "whitespace-nowrap");
  });

  it("uses the requested empty-state copy when no online submissions are available", () => {
    render(<ExitClearancesPageClient grantees={[]} />);

    expect(
      screen.getByText(
        "No exit clearances awaiting verification. Scholars can submit their clearance from their Grantee Dashboard.",
      ),
    ).toBeInTheDocument();
  });

  it("resets pagination to the first page when search text changes", () => {
    const manyGrantees = Array.from({ length: 12 }, (_, index) => ({
      ...grantees[0],
      id: `submitted-${index}`,
      fullName: index === 11 ? "Zoe Searchable" : `Scholar ${index}`,
      email: `scholar-${index}@example.com`,
    }));
    render(<ExitClearancesPageClient grantees={manyGrantees} />);

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search exit clearances" }), {
      target: { value: "Zoe" },
    });

    expect(screen.getByText("Zoe Searchable")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–1 of 1")).toBeInTheDocument();
  });
});
