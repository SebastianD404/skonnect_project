export const KK_PROFILING_MANUAL_REVIEW_NOTE =
  "Manual review requested: automated document scanner could not verify the uploaded documents.";

export function getKKProfilingReviewStatus(
  registrationStatus: string | null | undefined,
  profileIsVerified: boolean,
) {
  return registrationStatus || (profileIsVerified ? "Approved" : "Pending verification");
}

export function isKKProfilingManualReview(reviewNotes?: string | null) {
  return reviewNotes?.includes(KK_PROFILING_MANUAL_REVIEW_NOTE) ?? false;
}
