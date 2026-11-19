// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GranteeStatusTable, type GranteeTableRow } from "@/app/admin/grantees/GranteeStatusTable";
import AdminGranteesPageClient from "@/app/admin/AdminGranteesPageClient";
import { AdminSearchProvider } from "@/app/admin/AdminSearchContext";

const navigation = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  usePathname: () => "/admin/grantees",
  useSearchParams: () => navigation.searchParams,
}));

const grantee: GranteeTableRow = {
  id: "grantee-1",
  lastName: "Santos",
  firstName: "Mira",
  middleName: null,
  fullName: "Mira Santos",
  email: "mira@example.com",
  school: "Pico National High School",
  yearLevel: "Grade 12",
  currentJourneySemesterIndex: 0,
  validatedJourneySemesterIndexes: [],
  journeyNodes: [],
  journeyConfigured: false,
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
  onClearSearch = vi.fn(),
  granteeRow = grantee,
  onGranteeFilterChange = vi.fn(),
  onReviewGrantee = vi.fn(),
  dueCount = 0,
  submittedCount = 0,
}: {
  isLoading?: boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
  onClearSearch?: () => void;
  granteeRow?: GranteeTableRow;
  onGranteeFilterChange?: (filter: "all" | "due" | "submitted") => void;
  onReviewGrantee?: (grantee: GranteeTableRow) => void;
  dueCount?: number;
  submittedCount?: number;
} = {}) {
  return render(
    <GranteeStatusTable
      grantees={[granteeRow]}
      page={1}
      pageSize={10}
      totalCount={1}
      query={query}
      onQueryChange={onQueryChange}
      onClearSearch={onClearSearch}
      onGranteeFilterChange={onGranteeFilterChange}
      onReviewGrantee={onReviewGrantee}
      dueCount={dueCount}
      submittedCount={submittedCount}
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

  it("shows a clear-search control for a query and forwards the clear action", () => {
    const onClearSearch = vi.fn();
    renderTable({ query: "LUMEREZ, LEIZEL", onClearSearch });

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(onClearSearch).toHaveBeenCalledOnce();
  });

  it("shows the unconfigured journey fallback only in the row-hover popover", () => {
    const { container } = renderTable();

    expect(screen.queryByText("Academic journey not configured")).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Y\d+ S\d+/)).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Academic Journey" })).not.toBeInTheDocument();

    fireEvent.mouseEnter(container.querySelector("table tbody tr")!);

    expect(screen.getByText("Academic journey not configured")).toHaveClass(
      "text-xs",
      "text-slate-300",
    );
    expect(screen.getByRole("tooltip", { name: "Academic Journey for Mira Santos" })).toHaveClass(
      "pointer-events-none",
      "z-50",
      "bg-[#0B192C]",
      "rounded-xl",
      "shadow-xl",
    );
  });

  it("renders the straight-line journey with fraction, term tooltips, and state colors on row hover", () => {
    const journeyNodes: GranteeTableRow["journeyNodes"] = [
      {
        index: 0,
        semester: "2025-2026 First Semester",
        yearNumber: 3,
        semesterNumber: 1,
        academicTermCaption: "2025-2026 · 1st Sem",
        status: "VALIDATED",
      },
      {
        index: 1,
        semester: "2025-2026 Second Semester",
        yearNumber: 3,
        semesterNumber: 2,
        academicTermCaption: "2025-2026 · 2nd Sem",
        status: "VALIDATED",
      },
      {
        index: 2,
        semester: "2026-2027 First Semester",
        yearNumber: 4,
        semesterNumber: 1,
        academicTermCaption: "2026-2027 · 1st Sem",
        status: "VALIDATED",
      },
      {
        index: 3,
        semester: "2026-2027 Second Semester",
        yearNumber: 4,
        semesterNumber: 2,
        academicTermCaption: "2026-2027 · 2nd Sem",
        status: "CURRENT",
      },
    ];
    const { container } = renderTable({
      granteeRow: {
        ...grantee,
        journeyNodes,
        journeyConfigured: true,
        validatedJourneySemesterIndexes: [0, 1, 2],
      },
    });

    fireEvent.mouseEnter(container.querySelector("table tbody tr")!);

    expect(screen.getByText("3/4")).toBeInTheDocument();
    const currentNode = document.body.querySelectorAll(
      '[title="Y4 S2 · 2026–2027 2nd Sem — Current Step"]',
    );
    expect(currentNode).toHaveLength(1);
    expect(currentNode[0].querySelector("span.rounded-full")).toHaveClass(
      "bg-amber-400",
      "ring-2",
      "ring-amber-400/30",
    );
    const validatedNode = document.body.querySelector(
      '[title="Y3 S1 · 2025–2026 1st Sem — Validated"]',
    );
    expect(validatedNode?.querySelector("span.rounded-full")).toHaveClass(
      "bg-emerald-500",
    );
    expect(document.body.querySelector('[title="Graduation"] svg')).toHaveClass(
      "text-slate-400",
    );
  });

  it("matches a comma-separated profile name across the grantee name fields", async () => {
    navigation.searchParams = new URLSearchParams({
      search: "LUMEREZ, LEIZEL, PALANGCHAN",
    });
    const profileGrantee: GranteeTableRow = {
      ...grantee,
      lastName: "Lumerez",
      firstName: "Leizel",
      middleName: "Palangchan",
      fullName: "LUMEREZ, LEIZEL P.",
    };

    const view = render(
      <AdminSearchProvider>
        <AdminGranteesPageClient
          grantees={[profileGrantee]}
          page={1}
          pageSize={10}
          totalCount={1}
          query="LUMEREZ, LEIZEL, PALANGCHAN"
        />
      </AdminSearchProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("LUMEREZ, LEIZEL P.")).toHaveLength(2);
    });
    expect(screen.getByRole("searchbox", { name: "Search all active grantees" })).toHaveValue(
      "LUMEREZ, LEIZEL, PALANGCHAN",
    );

    navigation.searchParams = new URLSearchParams({ search: "Mira" });
    view.rerender(
      <AdminSearchProvider>
        <AdminGranteesPageClient
          grantees={[grantee]}
          page={1}
          pageSize={10}
          totalCount={1}
          query="Mira"
        />
      </AdminSearchProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole("searchbox", { name: "Search all active grantees" })).toHaveValue("Mira");
    });
  });

  it("shows clearance-submitted status ahead of the ready-to-graduate badge", () => {
    const { container } = renderTable({
      granteeRow: {
        ...grantee,
        graduationReadyAt: "2026-11-17T00:00:00.000Z",
        exitClearanceStatus: "SUBMITTED",
      },
    });

    expect(screen.getAllByText("Exit Clearance Pending")).toHaveLength(2);
    expect(screen.queryByText("Graduating")).not.toBeInTheDocument();
    expect(container.querySelector("table tbody tr td:nth-child(3)")?.textContent?.trim()).toContain("Active");
  });

  it("shows the submitted-clearance count and opens review from the row action", () => {
    const onGranteeFilterChange = vi.fn();
    const onReviewGrantee = vi.fn();
    const submittedGrantee = { ...grantee, exitClearanceStatus: "SUBMITTED" as const };
    renderTable({
      granteeRow: submittedGrantee,
      submittedCount: 3,
      onGranteeFilterChange,
      onReviewGrantee,
    });

    fireEvent.click(screen.getByRole("button", { name: "Clearance Submitted3" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Review & Graduate" })[0]);

    expect(onGranteeFilterChange).toHaveBeenCalledWith("submitted");
    expect(onReviewGrantee).toHaveBeenCalledWith(submittedGrantee);
  });

  it("uses a cohesive segmented control with the active total and highlighted due count", () => {
    const { container } = renderTable({
      dueCount: 2,
      submittedCount: 4,
    });

    expect(screen.getByRole("button", { name: "All1" })).toHaveAttribute("aria-pressed", "true");
    const dueFilter = screen.getByRole("button", { name: "Due for Graduation2" });
    expect(dueFilter).toHaveAttribute("aria-pressed", "false");
    expect(dueFilter.querySelector(".bg-amber-100")).toHaveTextContent("2");
    expect(dueFilter.querySelector(".bg-amber-500")).toBeInTheDocument();
    expect(container.querySelector("div.inline-flex.items-center.gap-1")).toHaveClass(
      "rounded-full",
      "border-slate-200/80",
      "bg-slate-100/90",
      "p-1",
    );
  });

  it("resets the page to one when an admin changes the filter", () => {
    navigation.searchParams = new URLSearchParams({ page: "4" });
    navigation.router.replace.mockClear();

    render(
      <AdminSearchProvider>
        <AdminGranteesPageClient
          grantees={[grantee]}
          page={4}
          pageSize={10}
          totalCount={1}
          allCount={8}
          query=""
        />
      </AdminSearchProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Due for Graduation0" }));

    expect(navigation.router.replace).toHaveBeenCalledWith(
      "/admin/grantees?page=1&filter=due",
      { scroll: false },
    );
    expect(screen.getByRole("button", { name: "All8" })).toBeInTheDocument();
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
