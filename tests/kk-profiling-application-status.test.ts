import { describe, expect, it } from "vitest";
import { getKkProfilingApplicationCardStatus } from "@/lib/kk-profiling-application-status";

describe("KK Profiling application card status", () => {
  it("maps no registration and draft to the correct actions", () => {
    expect(getKkProfilingApplicationCardStatus(null, false)).toMatchObject({
      label: "Not Registered",
      actionLabel: "Register Now",
      actionHref: "/programs/kk-profiling",
    });
    expect(getKkProfilingApplicationCardStatus("DRAFT", false)).toMatchObject({
      label: "Draft",
      actionLabel: "Continue Draft",
      actionHref: "/programs/kk-profiling",
    });
  });

  it.each([
    ["PENDING", "Pending Review", "amber"],
    ["UNDER_REVIEW", "Pending Review", "amber"],
    ["RESUBMITTED", "Resubmitted", "cyan"],
    ["RETURNED", "Returned for Correction", "amber"],
    ["WITHDRAWN", "Withdrawn", "slate"],
    ["REJECTED", "Rejected", "rose"],
  ] as const)("maps %s into a readable status and status action", (status, label, tone) => {
    expect(getKkProfilingApplicationCardStatus(status, false)).toMatchObject({
      label,
      tone,
      actionLabel: status === "RETURNED" ? "Update Submission" : "View Status",
      actionHref: "/programs/kk-profiling/status",
    });
  });

  it("only labels an approved applicant as a verified member when the KK profile is verified", () => {
    expect(getKkProfilingApplicationCardStatus("APPROVED", true)).toMatchObject({
      label: "Verified Member",
      actionLabel: "View Profile",
    });
    expect(getKkProfilingApplicationCardStatus("APPROVED", false)).toMatchObject({
      label: "Approved — Verification Pending",
      actionLabel: "View Status",
    });
  });

  it("formats unknown status values in title case instead of showing an unavailable fallback", () => {
    expect(getKkProfilingApplicationCardStatus("manual_review_pending", false)).toMatchObject({
      label: "Manual Review Pending",
      actionLabel: "View Status",
    });
  });
});
