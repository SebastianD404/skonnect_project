import { describe, expect, it } from "vitest";
import {
  buildSkeapResubmissionActivity,
  getApplicantUploadedFiles,
  getPendingSkeapDraftReplacements,
  getLatestSkeapResubmissionUploadKeys,
  getLatestSkeapResubmissionReplacements,
  getUnpersistedSkeapResubmissionReplacements,
  getUploadGroups,
  mergeSkeapDraftReplacement,
  mergeSkeapResubmittedFiles,
  normalizeUploadedFiles,
} from "@/lib/skeap-upload";

describe("SKEAP upload verification state", () => {
  it("preserves verification state when normalizing uploaded files", () => {
    expect(normalizeUploadedFiles({
      enrollmentCertificate: {
        url: "https://example.com/enrollment.pdf",
        name: "enrollment.pdf",
        verified: true,
      },
    })).toEqual({
      enrollmentCertificate: {
        url: "https://example.com/enrollment.pdf",
        name: "enrollment.pdf",
        verified: true,
      },
    });
  });

  it("exposes persisted verification state on upload groups", () => {
    expect(getUploadGroups({
      enrollmentCertificate: {
        url: "https://example.com/enrollment.pdf",
        verified: true,
        adminRemark: "Needs a clearer scan",
      },
    })).toContainEqual(expect.objectContaining({
      key: "enrollmentCertificate",
      verified: true,
      adminRemark: "Needs a clearer scan",
    }));
  });

  it("does not expose private remarks or verification state in applicant uploads", () => {
    expect(getApplicantUploadedFiles({
      enrollmentCertificate: {
        url: "https://example.com/enrollment.pdf",
        name: "enrollment.pdf",
        verified: true,
        adminRemark: "Needs a clearer scan",
      },
    })).toEqual({
      enrollmentCertificate: {
        url: "https://example.com/enrollment.pdf",
        name: "enrollment.pdf",
      },
    });
  });

  it("builds the admin resubmission event only from files that were replaced", () => {
    expect(
      buildSkeapResubmissionActivity([
        {
          slotId: "incomeCertificate",
          fileName: "income-proof.pdf",
          fileUrl: "https://example.com/income-proof.pdf",
          fileType: "application/pdf",
        },
      ])
    ).toEqual({
      eventType: "RESUBMISSION",
      text: "Applicant resubmitted 1 replacement file for review.",
      attachments: [
        {
          fileId: "incomeCertificate",
          documentLabel: "Family income certificate or income tax return",
          fileName: "income-proof.pdf",
          fileUrl: "https://example.com/income-proof.pdf",
          fileType: "application/pdf",
          adminRemark: "Applicant replacement upload",
        },
      ],
    });
  });

  it("identifies only files from the most recent applicant resubmission", () => {
    const updatedKeys = getLatestSkeapResubmissionUploadKeys([
      {
        role: "applicant",
        eventType: "RESUBMISSION",
        createdAt: "2026-10-06T10:00:00.000Z",
        attachments: [{ fileId: "gradeReport" }],
      },
      {
        role: "applicant",
        eventType: "RESUBMISSION",
        createdAt: "2026-10-07T10:00:00.000Z",
        attachments: [{ fileId: "incomeCertificate" }],
      },
    ]);

    expect([...updatedKeys]).toEqual(["incomeCertificate"]);
  });

  it("uses the latest activity attachment as the current replacement file", () => {
    const latestReplacements = getLatestSkeapResubmissionReplacements([
      {
        role: "applicant",
        eventType: "RESUBMISSION",
        createdAt: "2026-10-06T10:00:00.000Z",
        attachments: [{
          fileId: "incomeCertificate",
          fileName: "older.pdf",
          fileUrl: "https://example.com/older.pdf",
          fileType: "application/pdf",
        }],
      },
      {
        role: "applicant",
        eventType: "RESUBMISSION",
        createdAt: "2026-10-07T10:00:00.000Z",
        attachments: [{
          fileId: "incomeCertificate",
          fileName: "current.png",
          fileUrl: "https://example.com/current.png",
          fileType: "image/png",
        }],
      },
    ]);
    const effectiveUploads = mergeSkeapResubmittedFiles(
      {
        incomeCertificate: {
          url: "https://example.com/original.pdf",
          name: "original.pdf",
          verified: true,
        },
        gradeReport: {
          url: "https://example.com/grades.pdf",
          name: "grades.pdf",
          verified: true,
        },
      },
      latestReplacements
    );

    expect(effectiveUploads.incomeCertificate?.url).toBe("https://example.com/current.png");
    expect(effectiveUploads.incomeCertificate?.verified).toBe(false);
    expect(effectiveUploads.gradeReport?.verified).toBe(true);
  });

  it("persists the replacement URL while preserving verification on unchanged uploads", () => {
    const merged = mergeSkeapResubmittedFiles(
      {
        incomeCertificate: {
          url: "https://example.com/old-income.pdf",
          name: "old-income.pdf",
          verified: true,
          adminRemark: "Old remark",
        },
        gradeReport: {
          url: "https://example.com/grades.pdf",
          name: "grades.pdf",
          verified: true,
        },
      },
      [
        {
          slotId: "incomeCertificate",
          fileUrl: "https://example.com/new-income.png",
          fileName: "new-income.png",
          fileType: "image/png",
        },
      ]
    );

    expect(merged.incomeCertificate).toEqual({
      url: "https://example.com/new-income.png",
      name: "new-income.png",
      verified: false,
      adminRemark: "",
      fileType: "image/png",
    });
    expect(merged.gradeReport).toEqual({
      url: "https://example.com/grades.pdf",
      name: "grades.pdf",
      verified: true,
    });
    expect(getUploadGroups(merged)).toContainEqual(
      expect.objectContaining({
        key: "incomeCertificate",
        url: "https://example.com/new-income.png",
        name: "new-income.png",
        verified: false,
        isImage: true,
      })
    );
  });

  it("persists an applicant replacement as a pending draft without exposing admin review metadata", () => {
    const draft = mergeSkeapDraftReplacement(
      {
        incomeCertificate: {
          url: "https://example.com/old-income.pdf",
          name: "old-income.pdf",
          verified: true,
          adminRemark: "Private reviewer note",
        },
        gradeReport: {
          url: "https://example.com/grades.pdf",
          name: "grades.pdf",
          verified: true,
        },
      },
      {
        slotId: "incomeCertificate",
        fileUrl: "https://example.com/new-income.png",
        fileName: "new-income.png",
        fileType: "image/png",
      }
    );

    expect(draft.incomeCertificate).toEqual({
      url: "https://example.com/new-income.png",
      name: "new-income.png",
      verified: false,
      adminRemark: "",
      pendingResubmission: true,
      fileType: "image/png",
    });
    expect(draft.gradeReport?.verified).toBe(true);
    expect(getPendingSkeapDraftReplacements(draft)).toEqual([
      {
        slotId: "incomeCertificate",
        fileUrl: "https://example.com/new-income.png",
        fileName: "new-income.png",
        fileType: "image/png",
      },
    ]);
    const submitted = mergeSkeapResubmittedFiles(
      draft,
      getPendingSkeapDraftReplacements(draft)
    );
    expect(submitted.incomeCertificate?.pendingResubmission).toBeUndefined();
    expect(getApplicantUploadedFiles(draft)?.incomeCertificate).toEqual({
      url: "https://example.com/new-income.png",
      name: "new-income.png",
      pendingResubmission: true,
      fileType: "image/png",
    });
  });

  it("keeps saved verification state when a persisted replacement matches the resubmission activity", () => {
    const replacements = [{
      slotId: "incomeCertificate",
      fileName: "new-income.png",
      fileUrl: "https://example.com/new-income.png",
      fileType: "image/png",
    }];

    expect(getUnpersistedSkeapResubmissionReplacements({
      incomeCertificate: {
        url: "https://example.com/new-income.png",
        name: "new-income.png",
        verified: true,
      },
    }, replacements)).toEqual([]);

    expect(getUnpersistedSkeapResubmissionReplacements({
      incomeCertificate: {
        url: "https://example.com/old-income.png",
        name: "old-income.png",
        verified: true,
      },
    }, replacements)).toEqual(replacements);
  });
});
