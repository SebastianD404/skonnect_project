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

function getTimelinePreview() {
  return screen.getByText(
    (_, element) => element?.tagName === "P" && element.textContent?.includes("Timeline Preview:") === true,
  );
}

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
        startAcademicYear: "2026-2027",
        startSemester: 1,
        endSemester: 2,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AcademicJourneySetup
        journeyConfigured
        journeyStart="college-3"
        journeyEnd="college-4"
        startAcademicYear="2026-2027"
        startSemester={1}
        endSemester={2}
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
    fireEvent.change(screen.getByRole("combobox", { name: "Target Graduation Year" }), {
      target: { value: "college-5" },
    });

    expect(getTimelinePreview()).toHaveTextContent(
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
        body: JSON.stringify({
          journeyStart: "college-3",
          journeyEnd: "college-5",
          startAcademicYear: "2026-2027",
          startSemester: 1,
          endSemester: 2,
        }),
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Academic journey updated.");
  });

  it("defaults to the SKEAP year level and active semester for a Grade 12 to fifth-year range", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        journeyStart: "grade-12",
        journeyEnd: "college-5",
        startAcademicYear: "2026-2027",
        startSemester: 2,
        endSemester: 2,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AcademicJourneySetup
        journeyConfigured={false}
        journeyStart={null}
        journeyEnd={null}
        activeTerm={{ academicYear: "2026-2027", semester: 2 }}
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
    expect(screen.getByRole("combobox", { name: "Current Year Level" })).toHaveValue("grade-12");
    expect(screen.getByRole("combobox", { name: "Starting Semester" })).toHaveValue("2");
    expect(
      screen.getByRole("combobox", { name: "Starting Semester" }).querySelector('option[value="1"]'),
    ).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Target Graduation Year" }), {
      target: { value: "college-5" },
    });
    expect(getTimelinePreview()).toHaveTextContent(
      "Timeline Preview: 11 semesters (5.5 years) through Y5 2nd Sem.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Journey" }));

    await waitFor(() => {
      expect(screen.getByTestId("journey-summary")).toHaveTextContent(
        "11 nodes / 11 eligible (grade-12 to college-5)",
      );
    });
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/grantee/academic-journey",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          journeyStart: "grade-12",
          journeyEnd: "college-5",
          startAcademicYear: "2026-2027",
          startSemester: 2,
          endSemester: 2,
        }),
      }),
    );
  });

  it("preselects the active second semester and previews a five-node Y2 S2 journey", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        journeyStart: "college-2",
        journeyEnd: "college-4",
        startAcademicYear: "2026-2027",
        startSemester: 2,
        endSemester: 2,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AcademicJourneySetup
        journeyConfigured={false}
        journeyStart={null}
        journeyEnd={null}
        activeTerm={{ academicYear: "2026-2027", semester: 2 }}
        startingPointYearLevel="2nd Year"
        mapProps={{
          currentSemesterIndex: 0,
          validatedSemesterIndexes: [],
          eligibleSemesterCount: 0,
          journeyNodes: [],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Set Up Journey" }));
    expect(screen.getByRole("combobox", { name: "Current Year Level" })).toHaveValue("college-2");
    expect(screen.getByRole("combobox", { name: "Starting Semester" })).toHaveValue("2");
    fireEvent.change(screen.getByRole("combobox", { name: "Target Graduation Year" }), {
      target: { value: "college-4" },
    });

    expect(screen.getByText(/Journey: Y2 S2 \(2026–2027 · 2nd Sem\) to Y4 S2 \(2028–2029 · 2nd Sem\) · 5 semesters/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Journey" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/grantee/academic-journey",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            journeyStart: "college-2",
            journeyEnd: "college-4",
            startAcademicYear: "2026-2027",
            startSemester: 2,
            endSemester: 2,
          }),
        }),
      );
    });
  });

  it("reconciles an existing same-year S1 start to the active S2 in settings", () => {
    render(
      <AcademicJourneySetup
        journeyConfigured
        journeyStart="college-2"
        journeyEnd="college-4"
        startAcademicYear="2026-2027"
        startSemester={1}
        activeTerm={{ academicYear: "2026-2027", semester: 2 }}
        mapProps={{
          currentSemesterIndex: 0,
          validatedSemesterIndexes: [],
          eligibleSemesterCount: 8,
          journeyNodes: initialJourneyNodes,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Configure Academic Journey" }));
    expect(screen.getByRole("combobox", { name: "Starting Semester" })).toHaveValue("2");
  });
});
