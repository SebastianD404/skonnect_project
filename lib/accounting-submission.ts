export type AccountingSubmissionState =
  | "Approved"
  | "For Physical CTC"
  | "Pending Review"
  | "Returned"
  | "Not submitted";

export function isAccountingSubmissionSubmitted(status: string | null | undefined) {
  return getAccountingSubmissionState(status) !== "Not submitted";
}

export function getAccountingSubmissionState(
  status: string | null | undefined,
): AccountingSubmissionState {
  const normalized = status?.trim().toUpperCase().replace(/[\s-]+/g, "_");
  switch (normalized) {
    case "APPROVED":
      return "Approved";
    case "FOR_PHYSICAL_CTC":
    case "AWAITING_PHYSICAL_CTC":
      return "For Physical CTC";
    case "PENDING_REVIEW":
    case "PENDING":
    case "RESUBMITTED":
      return "Pending Review";
    case "RETURNED":
    case "RETURNED_FOR_EDIT":
    case "REJECTED":
      return "Returned";
    case "NOT_SUBMITTED":
      return "Not submitted";
    default:
      return "Not submitted";
  }
}
