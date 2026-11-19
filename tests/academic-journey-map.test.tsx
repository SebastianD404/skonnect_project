// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AcademicJourneyNode } from "@/lib/academic-journey";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/components/ui/Avatar", () => ({
  Avatar: () => null,
}));

import AcademicJourneyMap from "@/app/components/AcademicJourneyMap";

const startToYearFourNodes: AcademicJourneyNode[] = ([
  ["2026-2027 Second Semester", 2, 2, "2026-2027 · 2nd Sem"],
  ["2027-2028 First Semester", 2, 1, "2027-2028 · 1st Sem"],
  ["2027-2028 Second Semester", 3, 2, "2027-2028 · 2nd Sem"],
  ["2028-2029 First Semester", 3, 1, "2028-2029 · 1st Sem"],
  ["2028-2029 Second Semester", 4, 2, "2028-2029 · 2nd Sem"],
  ["2029-2030 First Semester", 4, 1, "2029-2030 · 1st Sem"],
] as const).map(([semester, yearNumber, semesterNumber, academicTermCaption], index) => ({
  index,
  semester,
  yearNumber,
  semesterNumber,
  academicTermCaption,
  scheduleStatus: index === 0 ? "open" as const : null,
  status: index === 0 ? "CURRENT" as const : "LOCKED" as const,
  submissionId: null,
  submittedAt: null,
  approvedAt: null,
  gwa: null,
  remarks: null,
  gradeReportUrl: null,
  coeFileUrl: null,
  isInitialGrant: false,
}));

describe("AcademicJourneyMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(Date.now()), 0),
    );
    vi.stubGlobal("cancelAnimationFrame", (frame: number) => window.clearTimeout(frame));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("aligns a second-semester Year 2 start through the configured Year 4 second-semester finish", () => {
    const { container } = render(
      <AcademicJourneyMap
        studentName="Test Student"
        currentSemesterIndex={0}
        validatedSemesterIndexes={[]}
        currentStepStatus="open_for_submit"
        eligibleSemesterCount={5}
        journeyNodes={startToYearFourNodes}
        journeyStart="college-2"
        journeyEnd="college-4"
      />,
    );

    expect(
      Array.from(container.querySelectorAll("span"))
        .map((node) => node.textContent?.trim())
        .filter((text) => /^Y\d S[12]$/.test(text ?? "")),
    ).toEqual(["Y2 S2", "Y3 S1", "Y3 S2", "Y4 S1", "Y4 S2"]);
    expect(screen.getByText("2026–2027 · 2nd Sem")).toBeInTheDocument();
    expect(screen.getByText("2027–2028 · 1st Sem")).toBeInTheDocument();
    expect(screen.getByText("2027–2028 · 2nd Sem")).toBeInTheDocument();
    expect(screen.getByText("2028–2029 · 1st Sem")).toBeInTheDocument();
    expect(screen.getByText("2028–2029 · 2nd Sem")).toBeInTheDocument();
    expect(screen.getByText("0 of 5 semesters validated")).toBeInTheDocument();
    expect(screen.getByText("Track validated semesters toward graduation.")).toBeInTheDocument();
    expect(screen.getByText("Halfway milestone")).toBeInTheDocument();
    expect(screen.getByText("Final year")).toBeInTheDocument();
    expect(screen.getByText("FINAL SEM")).toBeInTheDocument();
    expect(screen.getByText("Current step")).toBeInTheDocument();
    expect(screen.getByText("OPEN NOW")).toBeInTheDocument();
  });

  it("navigates from the current node and keeps locked and graduation nodes disabled", () => {
    const nodes = startToYearFourNodes.slice(0, 5).map((node, index) => ({
      ...node,
      status: index === 0 ? "CURRENT" as const : "LOCKED" as const,
    }));
    render(
      <AcademicJourneyMap
        currentSemesterIndex={0}
        validatedSemesterIndexes={[]}
        currentStepStatus="open_for_submit"
        journeyNodes={nodes}
        journeyStart="college-2"
        journeyEnd="college-4"
      />,
    );

    fireEvent.click(screen.getByRole("button", {
      name: "Y2 S2, 2026–2027 2nd Sem — Open requirements",
    }));
    expect(mocks.push).toHaveBeenCalledWith("/grantee-dashboard/documents#submit-requirements");

    const lockedNode = screen.getByRole("button", {
      name: "Y3 S1, 2027–2028 1st Sem — Locked. Unlocks in 2027–2028 1st Sem",
    });
    expect(lockedNode).toBeDisabled();
    expect(lockedNode).toHaveAttribute("aria-disabled", "true");
    expect(lockedNode).toHaveClass("cursor-not-allowed");
    fireEvent.mouseEnter(lockedNode.parentElement!);
    expect(screen.getByText("Unlocks in 2027–2028 1st Sem")).toBeInTheDocument();

    const graduationNode = screen.getByRole("button", { name: /Graduation milestone: locked/ });
    expect(graduationNode).toBeDisabled();
    expect(graduationNode).toHaveAttribute("aria-disabled", "true");
    expect(graduationNode).toHaveClass("cursor-not-allowed");
  });

  it("opens a read-only semester modal with validated documents and dates", () => {
    const nodes = startToYearFourNodes.slice(0, 5).map((node, index) => index === 0
      ? {
          ...node,
          status: "VALIDATED" as const,
          submissionId: "submission-1",
          submittedAt: "2027-06-15T00:00:00.000Z",
          approvedAt: "2027-06-20T00:00:00.000Z",
          gradeReportUrl: "/api/submissions/submission-1/file?kind=grade",
          coeFileUrl: "/api/submissions/submission-1/file?kind=coe",
          gradesStatus: "APPROVED",
          coeStatus: "APPROVED",
        }
      : { ...node, status: index === 1 ? "CURRENT" as const : "LOCKED" as const });

    render(
      <AcademicJourneyMap
        currentSemesterIndex={1}
        validatedSemesterIndexes={[0]}
        currentStepStatus="open_for_submit"
        journeyNodes={nodes}
        journeyStart="college-2"
        journeyEnd="college-4"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "View submitted files for Y2 S2" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("2026-2027 Second Semester");
    expect(dialog).toHaveTextContent("Submitted");
    expect(dialog).toHaveTextContent("Approved");
    expect(dialog).toHaveTextContent("Validated");
    expect(screen.getByRole("link", { name: "Preview Grade Report" })).toHaveAttribute(
      "href",
      "/api/submissions/submission-1/file?kind=grade",
    );
    expect(screen.getByRole("link", { name: "Preview Certificate of Enrollment" })).toHaveAttribute(
      "href",
      "/api/submissions/submission-1/file?kind=coe",
    );
  });

  it("shows a no-documents message instead of opening an empty validated-step modal", () => {
    const nodes = startToYearFourNodes.slice(0, 5).map((node, index) => ({
      ...node,
      status: index === 0 ? "VALIDATED" as const : index === 1 ? "CURRENT" as const : "LOCKED" as const,
    }));
    render(
      <AcademicJourneyMap
        currentSemesterIndex={1}
        validatedSemesterIndexes={[0]}
        currentStepStatus="open_for_submit"
        journeyNodes={nodes}
        journeyStart="college-2"
        journeyEnd="college-4"
      />,
    );

    const validatedNode = screen.getByRole("button", { name: /No documents submitted for this semester/ });
    expect(validatedNode).toHaveAttribute("title", "No documents submitted for this semester");
    fireEvent.mouseEnter(validatedNode.parentElement!);
    expect(screen.getByText("No documents submitted for this semester")).toBeInTheDocument();
    fireEvent.click(validatedNode);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
