import { describe, expect, it } from "vitest";
import {
  isSkeapApplicationRejected,
  isSkeapApplicationReturned,
  isSkeapUploadMarkedForCorrection,
  skeapPendingApplicationsWhere,
  skeapStatusWhere,
} from "@/lib/skeap-applications";

describe("SKEAP status filters", () => {
  it("counts pending applications from the selected academic year queue", () => {
    const academicYearRange = {
      start: new Date("2026-08-01T00:00:00.000Z"),
      end: new Date("2027-08-01T00:00:00.000Z"),
    };

    expect(skeapPendingApplicationsWhere(academicYearRange)).toEqual({
      subject: {
        contains: "SKEAP application",
        mode: "insensitive",
      },
      NOT: [
        { reviewStatus: { contains: "cancel", mode: "insensitive" } },
        { reviewStatus: { contains: "approve", mode: "insensitive" } },
      ],
      AND: [
        {
          createdAt: {
            gte: academicYearRange.start,
            lt: academicYearRange.end,
          },
        },
        {
          OR: [
            { reviewStatus: { contains: "pending", mode: "insensitive" } },
            { reviewStatus: { contains: "pre_qualified", mode: "insensitive" } },
          ],
        },
      ],
    });
  });

  it("matches only the structured review status, not free-text reviewer responses", () => {
    expect(skeapStatusWhere(["resubm", "resubmit"])).toEqual({
      OR: [
        {
          reviewStatus: {
            contains: "resubm",
            mode: "insensitive",
          },
        },
        {
          reviewStatus: {
            contains: "resubmit",
            mode: "insensitive",
          },
        },
      ],
    });
  });

  it("identifies rejected applications regardless of status casing", () => {
    expect(isSkeapApplicationRejected("REJECTED")).toBe(true);
    expect(isSkeapApplicationRejected("Rejected")).toBe(true);
    expect(isSkeapApplicationRejected("Returned")).toBe(false);
    expect(isSkeapApplicationRejected("Resubmitted")).toBe(false);
    expect(isSkeapApplicationRejected(null)).toBe(false);
  });

  it("identifies only formally returned application statuses", () => {
    expect(isSkeapApplicationReturned("Returned")).toBe(true);
    expect(isSkeapApplicationReturned("NEEDS_REVISION")).toBe(true);
    expect(isSkeapApplicationReturned("RETURNED_FOR_EDIT")).toBe(true);
    expect(isSkeapApplicationReturned("Pending Review")).toBe(false);
    expect(isSkeapApplicationReturned("Resubmitted")).toBe(false);
    expect(isSkeapApplicationReturned(null)).toBe(false);
  });

  it("marks only documents explicitly attached to the latest return action", () => {
    const reviewThread = [
      {
        role: "admin",
        action: "return",
        attachments: [{ fileId: "incomeCertificate", fileUrl: "https://files/income.pdf" }],
      },
      {
        role: "admin",
        text: "COR needs correction",
        attachments: [{ fileId: "enrollmentCertificate", fileUrl: "https://files/cor.pdf" }],
      },
    ];

    expect(
      isSkeapUploadMarkedForCorrection(reviewThread, {
        slotId: "incomeCertificate",
        originalUrl: "https://files/income.pdf",
      })
    ).toBe(true);
    expect(
      isSkeapUploadMarkedForCorrection(reviewThread, {
        slotId: "enrollmentCertificate",
        originalUrl: "https://files/cor.pdf",
      })
    ).toBe(false);
  });

  it("uses the latest return action and does not infer corrections from message text", () => {
    const reviewThread = [
      {
        role: "admin",
        action: "return",
        attachments: [{ fileId: "gradeReport", fileUrl: "https://files/grade.pdf" }],
      },
      {
        role: "admin",
        action: "return",
        attachments: [{ fileId: "incomeCertificate", fileUrl: "https://files/income.pdf" }],
      },
    ];

    expect(
      isSkeapUploadMarkedForCorrection(reviewThread, {
        slotId: "incomeCertificate",
        originalUrl: "https://files/income.pdf",
      })
    ).toBe(false);
    expect(
      isSkeapUploadMarkedForCorrection(reviewThread, {
        slotId: "gradeReport",
        originalUrl: "https://files/grade.pdf",
      })
    ).toBe(true);
  });

  it("uses the newest attached admin message for legacy returns without an action marker", () => {
    const reviewThread = [
      {
        role: "admin",
        attachments: [{ fileId: "incomeCertificate", fileUrl: "https://files/income.pdf" }],
      },
      {
        role: "admin",
        attachments: [{ fileId: "gradeReport", fileUrl: "https://files/grade.pdf" }],
      },
    ];

    expect(
      isSkeapUploadMarkedForCorrection(reviewThread, {
        slotId: "incomeCertificate",
        originalUrl: "https://files/income.pdf",
      })
    ).toBe(true);
    expect(
      isSkeapUploadMarkedForCorrection(reviewThread, {
        slotId: "gradeReport",
        originalUrl: "https://files/grade.pdf",
      })
    ).toBe(false);
  });
});
