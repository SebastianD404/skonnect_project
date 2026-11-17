export type GranteeDocumentsSubmission = {
  id: string;
  semester: string;
  status: string;
  submittedAt: string;
  gradeFileUrl: string;
  coeFileUrl: string;
};

export type GranteeDocumentsTermSchedule = {
  semester: string;
  opensAt: string;
};

export function getFullyClearedSubmissionAwaitingNextWindow(
  submissions: GranteeDocumentsSubmission[],
  targetSemester: string,
  schedules: GranteeDocumentsTermSchedule[],
  now: Date,
) {
  const targetSchedule = schedules.find((schedule) => schedule.semester === targetSemester);
  if (!targetSchedule || new Date(targetSchedule.opensAt).getTime() <= now.getTime()) {
    return null;
  }

  const latestSubmission = submissions.reduce<GranteeDocumentsSubmission | null>(
    (latest, submission) => {
      if (!latest || new Date(submission.submittedAt).getTime() > new Date(latest.submittedAt).getTime()) {
        return submission;
      }
      return latest;
    },
    null,
  );

  return latestSubmission?.status === "APPROVED" &&
    Boolean(latestSubmission.gradeFileUrl) &&
    Boolean(latestSubmission.coeFileUrl)
    ? latestSubmission
    : null;
}
