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
  journeyStart?: string | null;
  journeyEnd?: string | null;
  onConfigureJourney?: () => void;
};

vi.mock("@/app/components/AcademicJourneyMap", () => ({
  default: ({ journeyNodes, eligibleSemesterCount, journeyStart, journeyEnd, onConfigureJourney }: MockJourneyMapProps) => (
    <div>
      <p data-testid="journey-summary">
        {journeyNodes?.length ?? 0} nodes / {eligibleSemesterCount ?? 0} eligible ({journeyStart} to {journeyEnd})
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
      json: async () => ({
        journeyStart: "college-3",
        journeyEnd: "college-5",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AcademicJourneySetup
        journeyConfigured
        journeyStart="college-3"
        journeyEnd="college-4"
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
      "Timeline Preview: 6 semesters (3 years) through Y5 2nd Sem.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Journey" }));

    await waitFor(() => {
      expect(screen.getByTestId("journey-summary")).toHaveTextContent("6 nodes / 6 eligible (college-3 to college-5)");
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

  it("defaults to the SKEAP year level and immediately shows the full Grade 12 to fifth-year range", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        journeyStart: "grade-12",
        journeyEnd: "college-5",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AcademicJourneySetup
        journeyConfigured={false}
        journeyStart={null}
        journeyEnd={null}
        startingPointYearLevel="Grade 12"
        mapProps={{
          currentSemesterIndex: 0,
          validatedSemesterIndexes: [],
          eligibleSemesterCount: 0,
          journeyNodes: [],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Set Up Journey" }));
    expect(screen.getByRole("combobox", { name: "Starting Point" })).toHaveValue("grade-12");
    fireEvent.change(screen.getByRole("combobox", { name: "Target Graduation" }), {
      target: { value: "college-5" },
    });
    expect(screen.getByText("Timeline Preview:").parentElement).toHaveTextContent(
      "Timeline Preview: 12 semesters (6 years) through Y5 2nd Sem.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Journey" }));

    await waitFor(() => {
      expect(screen.getByTestId("journey-summary")).toHaveTextContent(
        "12 nodes / 12 eligible (grade-12 to college-5)",
      );
    });
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/grantee/academic-journey",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ journeyStart: "grade-12", journeyEnd: "college-5" }),
      }),
    );
  });
});
