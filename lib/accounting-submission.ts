const statusesThatNeedResubmission = new Set(["REJECTED", "RETURNED_FOR_EDIT"]);

export function isAccountingSubmissionSubmitted(status: string | null | undefined) {
  if (!status) return false;
  return !statusesThatNeedResubmission.has(status.toUpperCase());
}

export function getAccountingSubmissionState(status: string | null | undefined) {
  if (!isAccountingSubmissionSubmitted(status)) return "Not submitted";
  return status?.toUpperCase() === "APPROVED" ? "Approved" : "Pending review";
}
