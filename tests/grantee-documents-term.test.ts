import { describe, expect, it } from "vitest";
import { getFullyClearedSubmissionAwaitingNextWindow } from "../lib/grantee-documents-term";

const completedSubmission = {
  id: "submission-1",
  semester: "2026-2027 First Semester",
  status: "APPROVED",
  submittedAt: "2026-07-01T00:00:00.000Z",
  gradeFileUrl: "grade.pdf",
  coeFileUrl: "coe.pdf",
};

const nextSchedule = {
  semester: "2026-2027 Second Semester",
  opensAt: "2027-01-04T00:00:00.000Z",
};

describe("getFullyClearedSubmissionAwaitingNextWindow", () => {
  it("keeps the latest fully cleared submission visible before the next window opens", () => {
    expect(
      getFullyClearedSubmissionAwaitingNextWindow(
        [completedSubmission],
        nextSchedule.semester,
        [nextSchedule],
        new Date("2027-01-03T23:59:59.999Z"),
      ),
    ).toEqual(completedSubmission);
  });

  it("switches away from the completed submission when the next window opens", () => {
    expect(
      getFullyClearedSubmissionAwaitingNextWindow(
        [completedSubmission],
        nextSchedule.semester,
        [nextSchedule],
        new Date(nextSchedule.opensAt),
      ),
    ).toBeNull();
  });

  it("does not keep showing an old cleared submission when a newer submission exists", () => {
    expect(
      getFullyClearedSubmissionAwaitingNextWindow(
        [
          { ...completedSubmission, submittedAt: "2026-07-01T00:00:00.000Z" },
          {
            ...completedSubmission,
            id: "submission-2",
            semester: nextSchedule.semester,
            status: "PENDING",
            submittedAt: "2026-12-20T00:00:00.000Z",
          },
        ],
        nextSchedule.semester,
        [nextSchedule],
        new Date("2027-01-03T00:00:00.000Z"),
      ),
    ).toBeNull();
  });
});
