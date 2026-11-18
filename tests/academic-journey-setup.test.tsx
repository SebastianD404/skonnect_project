// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AcademicJourneyNode } from "@/lib/academic-journey";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

type MockJourneyMapProps = {
  journeyNodes?: AcademicJourneyNode[];
  eligibleSemesterCount?: number;
  onConfigureJourney?: () => void;
};

vi.mock("@/app/components/AcademicJourneyMap", () => ({
  default: ({ journeyNodes, eligibleSemesterCount, onConfigureJourney }: MockJourneyMapProps) => (
    <div>
      <p data-testid="journey-summary">
        {journeyNodes?.length ?? 0} nodes / {eligibleSemesterCount ?? 0} eligible
      </p>
      <button type="button" onClick={onConfigureJourney}>Configure Academic Journey</button>
    </div>
  ),
}));

import AcademicJourneySetup from "@/app/grantee-dashboard/AcademicJourneySetup";

const initialJourneyNodes: AcademicJourneyNode[] = [
  {
    index: 0, semester: "2026-2027 Second Semester", yearNumber: 3, semesterNumber: 2, status: "CURRENT",
    submissionId: null, submittedAt: null, approvedAt: null, gwa: null, remarks: null,
    gradeReportUrl: null, coeFileUrl: null, isInitialGrant: false,
  },
  {
    index: 1, semester: "2027-2028 First Semester", yearNumber: 4, semesterNumber: 1, status: "LOCKED",
    submissionId: null, submittedAt: null, approvedAt: null, gwa: null, remarks: null,
    gradeReportUrl: null, coeFileUrl: null, isInitialGrant: false,
  },
  {
    index: 2, semester: "2027-2028 Second Semester", yearNumber: 4, semesterNumber: 2, status: "LOCKED",
    submissionId: null, submittedAt: null, approvedAt: null, gwa: null, remarks: null,
    gradeReportUrl: null, coeFileUrl: null, isInitialGrant: false,
  },
];

describe("AcademicJourneySetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("previews and immediately applies a fifth-year target after saving", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ journeyStart: "college-3", journeyEnd: "college-5" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AcademicJourneySetup
        journeyConfigured
        journeyStart="college-3"
        journeyEnd="college-4"
        yearLevel="3rd Year"
        entryAcademicYear="2026-2027"
        entrySemester="Second Semester"
        mapProps={{
          currentSemesterIndex: 0,
          validatedSemesterIndexes: [],
          eligibleSemesterCount: 3,
          journeyNodes: initialJourneyNodes,
        }}
      />,
    );

    expect(screen.getByTestId("journey-summary")).toHaveTextContent("3 nodes / 3 eligible");
    fireEvent.click(screen.getByRole("button", { name: "Configure Academic Journey" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Target Graduation" }), {
      target: { value: "college-5" },
    });

    expect(screen.getByText("Timeline Preview:").parentElement).toHaveTextContent(
      "Timeline Preview: 5 semesters (2.5 years) through Y5 2nd Sem.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Journey" }));

    await waitFor(() => {
      expect(screen.getByTestId("journey-summary")).toHaveTextContent("5 nodes / 5 eligible");
    });
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/grantee/academic-journey",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ journeyStart: "college-3", journeyEnd: "college-5" }),
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Academic journey updated.");
  });

  it("shows setup first and prefills suggestions from the grantee record", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ journeyStart: "college-3", journeyEnd: "college-4" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AcademicJourneySetup
        journeyConfigured={false}
        journeyStart={null}
        journeyEnd={null}
        yearLevel="3rd Year"
        entryAcademicYear="2026-2027"
        entrySemester="Second Semester"
        mapProps={{
          currentSemesterIndex: 0,
          validatedSemesterIndexes: [],
          eligibleSemesterCount: 7,
          journeyNodes: initialJourneyNodes,
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Set Up Your Academic Journey" })).toBeInTheDocument();
    expect(screen.getByText(/Confirm your degree length and expected graduation term/)).toBeInTheDocument();
    expect(screen.queryByTestId("journey-summary")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Set Up Your Academic Journey" }));
    expect(screen.getByRole("combobox", { name: "Starting Point" })).toHaveValue("college-3");
    expect(screen.getByRole("combobox", { name: "Target Graduation" })).toHaveValue("college-4");
    expect(screen.getAllByText(/Entry term 2026-2027 Second Semester/)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Save Journey" }));
    await waitFor(() => {
      expect(screen.getByTestId("journey-summary")).toHaveTextContent("3 nodes / 3 eligible");
    });
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
