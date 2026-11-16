export type KkProfilingApplicationCardStatus = {
  label: string;
  tone: "emerald" | "amber" | "cyan" | "rose" | "slate";
  actionLabel: string;
  actionHref: string;
};

const REGISTRATION_HREF = "/programs/kk-profiling";
const STATUS_HREF = "/programs/kk-profiling/status";

function titleCaseStatus(status: string) {
  return status
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : word)
    .join(" ");
}

export function getKkProfilingApplicationCardStatus(
  status: string | null | undefined,
  isProfileVerified: boolean,
): KkProfilingApplicationCardStatus {
  const normalized = status?.trim().toUpperCase().replace(/[\s-]+/g, "_") ?? "";

  if (!normalized) {
    return {
      label: "Not Registered",
      tone: "slate",
      actionLabel: "Register Now",
      actionHref: REGISTRATION_HREF,
    };
  }

  if (normalized === "DRAFT") {
    return {
      label: "Draft",
      tone: "slate",
      actionLabel: "Continue Draft",
      actionHref: REGISTRATION_HREF,
    };
  }

  if (["PENDING", "PENDING_REVIEW", "PENDING_VERIFICATION", "UNDER_REVIEW"].includes(normalized)) {
    return {
      label: "Pending Review",
      tone: "amber",
      actionLabel: "View Status",
      actionHref: STATUS_HREF,
    };
  }

  if (normalized === "RESUBMITTED" || normalized === "RESUBMITTED_FILES") {
    return {
      label: "Resubmitted",
      tone: "cyan",
      actionLabel: "View Status",
      actionHref: STATUS_HREF,
    };
  }

  if (["RETURNED", "RETURNED_FOR_CORRECTION", "RETURNED_FOR_EDIT"].includes(normalized)) {
    return {
      label: "Returned for Correction",
      tone: "amber",
      actionLabel: "Update Submission",
      actionHref: STATUS_HREF,
    };
  }

  if (normalized === "APPROVED") {
    return isProfileVerified
      ? {
          label: "Verified Member",
          tone: "emerald",
          actionLabel: "View Profile",
          actionHref: STATUS_HREF,
        }
      : {
          label: "Approved — Verification Pending",
          tone: "amber",
          actionLabel: "View Status",
          actionHref: STATUS_HREF,
        };
  }

  if (normalized === "WITHDRAWN") {
    return {
      label: "Withdrawn",
      tone: "slate",
      actionLabel: "View Status",
      actionHref: STATUS_HREF,
    };
  }

  if (normalized === "REJECTED") {
    return {
      label: "Rejected",
      tone: "rose",
      actionLabel: "View Status",
      actionHref: STATUS_HREF,
    };
  }

  return {
    label: titleCaseStatus(status ?? ""),
    tone: "slate",
    actionLabel: "View Status",
    actionHref: STATUS_HREF,
  };
}
