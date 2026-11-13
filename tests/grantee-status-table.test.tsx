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
  contactNumber: "09171234567",
  dateEnrolled: "2025-01-15T00:00:00.000Z",
  updatedAt: "2025-01-15T00:00:00.000Z",
};

function renderTable({
  isLoading = false,
  query = "",
  onQueryChange = vi.fn(),
}: {
  isLoading?: boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
} = {}) {
  return render(
    <GranteeStatusTable
      grantees={[grantee]}
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
});
