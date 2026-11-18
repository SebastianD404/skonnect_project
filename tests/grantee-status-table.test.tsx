// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GranteeStatusTable, type GranteeTableRow } from "@/app/admin/grantees/GranteeStatusTable";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn() } }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));

const grantee: GranteeTableRow = {
  id: "grantee-1",
  fullName: "Mira Santos",
  email: "mira@example.com",
  school: "Pico National High School",
  yearLevel: "Grade 12",
  currentJourneySemesterIndex: 0,
  validatedJourneySemesterIndexes: [],
  status: "ACTIVE",
  graduationReadyAt: null,
  exitClearanceStatus: "NONE",
  contactNumber: "09171234567",
  dateEnrolled: "2025-01-15T00:00:00.000Z",
  updatedAt: "2025-01-15T00:00:00.000Z",
};

function renderTable({
  isLoading = false,
  query = "",
  onQueryChange = vi.fn(),
  granteeRow = grantee,
}: {
  isLoading?: boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
  granteeRow?: GranteeTableRow;
} = {}) {
  return render(
    <GranteeStatusTable
      grantees={[granteeRow]}
      page={1}
      pageSize={10}
      totalCount={1}
      query={query}
      onQueryChange={onQueryChange}
      isLoading={isLoading}
      startNavigation={(callback) => callback()}
    />,
  );
}

describe("GranteeStatusTable", () => {
  it("keeps server-matched rows when the search term is not in the visible name fields", () => {
    renderTable({ query: "09171234567" });

    expect(screen.getAllByText("Mira Santos")).toHaveLength(2);
  });

  it("forwards search input changes and shows skeletons while results are pending", () => {
    const onQueryChange = vi.fn();
    renderTable({ isLoading: true, query: "Mira", onQueryChange });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search all active grantees" }), {
      target: { value: "09171234567" },
    });

    expect(onQueryChange).toHaveBeenCalledWith("09171234567");
    expect(screen.getByRole("status")).toHaveTextContent("Searching active grantees");
    expect(screen.queryByText("Mira Santos")).not.toBeInTheDocument();
  });

  it("shows clearance-submitted status ahead of the ready-to-graduate badge", () => {
    const { container } = renderTable({
      granteeRow: {
        ...grantee,
        graduationReadyAt: "2026-11-17T00:00:00.000Z",
        exitClearanceStatus: "SUBMITTED",
      },
    });

    expect(screen.getAllByText("Clearance Submitted")).toHaveLength(2);
    expect(screen.queryByText("Graduating")).not.toBeInTheDocument();
    expect(container.querySelector("table tbody tr td:nth-child(3)")?.textContent?.trim()).toBe("Active");
  });

  it("shows the ready-to-graduate status when clearance is not submitted", () => {
    const { container } = renderTable({
      granteeRow: {
        ...grantee,
        graduationReadyAt: "2026-11-17T00:00:00.000Z",
      },
    });

    expect(screen.getAllByText("Graduating")).toHaveLength(2);
    expect(screen.getAllByTitle("Ready to Graduate")).toHaveLength(2);
    expect(container.querySelector("table tbody tr td:nth-child(3)")?.textContent?.trim()).toBe("Active");
    const actionHeader = Array.from(container.querySelectorAll("th")).find(
      (header) => header.textContent?.trim() === "Action",
    );
    const actionCell = container.querySelector("table tbody tr td:last-child");
    expect(container.querySelector("table tbody tr")).toHaveClass("h-[72px]");
    expect(container.querySelector("table tbody tr td:nth-child(3)")).toHaveClass("align-middle");
    expect(actionHeader).toHaveClass("text-right");
    expect(actionCell).toHaveClass("text-right");
    expect(actionCell?.querySelector("div")).toHaveClass("justify-end");
  });
});
