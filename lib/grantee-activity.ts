export type GranteeActivityKind = "approved" | "attention" | "pending" | "confirmed";

export type GranteeActivity = {
  id: string;
  label: string;
  date: Date;
  kind: GranteeActivityKind;
  detail?: string;
};

type SubmissionActivitySource = {
  id: string;
  semester: string;
  status: string;
  submittedAt: Date;
  reviewedAt: Date | null;
};

type PayoutActivitySource = {
  id: string;
  semester: string | null;
  amount: number;
  claimedAt: Date | null;
};

function formatPayoutAmount(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getSubmissionActivityLabel(status: string) {
  switch (status) {
    case "APPROVED":
      return "Submission · approved";
    case "REJECTED":
    case "RETURNED_FOR_EDIT":
      return "Submission · changes requested";
    default:
      return "Submission · submitted";
  }
}

export function buildGranteeActivity(
  submissions: readonly SubmissionActivitySource[],
  payout: PayoutActivitySource | null,
): GranteeActivity[] {
  const activities: GranteeActivity[] = submissions.map((submission) => ({
    id: `submission:${submission.id}`,
    label: getSubmissionActivityLabel(submission.status),
    date:
      submission.status === "PENDING" || !submission.reviewedAt
        ? submission.submittedAt
        : submission.reviewedAt,
    detail: submission.semester,
    kind:
      submission.status === "APPROVED"
        ? "approved"
        : submission.status === "REJECTED" || submission.status === "RETURNED_FOR_EDIT"
          ? "attention"
          : "pending",
  }));

  if (payout?.claimedAt) {
    activities.push({
      id: `payout-confirmed:${payout.id}`,
      label: `${payout.semester ?? "SKEAP"} payout · receipt confirmed`,
      date: payout.claimedAt,
      kind: "confirmed",
      detail: formatPayoutAmount(payout.amount),
    });
  }

  return activities.sort((first, second) => second.date.getTime() - first.date.getTime());
}
