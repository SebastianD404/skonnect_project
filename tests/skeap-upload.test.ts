import { describe, expect, it } from "vitest";
import {
  buildSkeapResubmissionActivity,
  areRequiredSkeapDocumentsPreScreened,
  getApplicantUploadedFiles,
  getPendingSkeapDraftReplacements,
  getLatestSkeapResubmissionUploadKeys,
  getLatestSkeapResubmissionReplacements,
  getUnpersistedSkeapResubmissionReplacements,
  getSkeapRequiredDocuments,
  getUploadGroups,
  getSupportedSkeapDocumentType,
  mergeSkeapDraftReplacement,
  mergeSkeapResubmittedFiles,
  normalizeUploadedFiles,
  normalizeUploadRequirement,
  SKEAP_UPLOAD_KEY,
} from "@/lib/skeap-upload";

describe("SKEAP required document labels", () => {
  it("requires all four digital uploads with ordinance-specific helper text", () => {
    expect(getSkeapRequiredDocuments("College", "1st Year")).toEqual([
      {
        key: SKEAP_UPLOAD_KEY.FAMILY_INCOME,
        label: "Certificate of Low-Income",
        helperText: 'Must state purpose: "Sangguniang Kabataan Educational Assistance Program"',
      },
      {
        key: SKEAP_UPLOAD_KEY.ENROLLMENT_CERT,
        label: "Certificate of Enrollment",
        helperText: "Current semester/school year enrollment form or COE",
      },
      { key: SKEAP_UPLOAD_KEY.GRADE_REPORT, label: "Grades Issued by School Registrar" },
      {
        key: SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE,
        label: "COMELEC Voter's Certificate (Barangay Pico)",
      },
    ]);
  });

  it("uses the level-appropriate grades label and voter certificate holder", () => {
    const highSchoolDocs = getSkeapRequiredDocuments("Senior High School", "Grade 11", 17, false);

    expect(highSchoolDocs[2].label).toBe("Certified True Copy of Report Card / Form 138");
    expect(highSchoolDocs[3].label).toBe(
      "Parent / Guardian's COMELEC Voter's Certificate (Barangay Pico)",
    );

    const registeredApplicantDocs = getSkeapRequiredDocuments("College", "1st Year", 18, true);
    expect(registeredApplicantDocs[3].label).toBe(
      "Applicant's COMELEC Voter's Certificate (Barangay Pico)",
    );
    expect(
      getSkeapRequiredDocuments("Technical and Vocational (Tech-Voc)", "1st Semester")[2].label,
    ).toBe("Grades Issued by School Registrar");
  });
});

describe("SKEAP document file types", () => {
  it.each([
    [{ name: "certificate.pdf", type: "application/pdf" }, "application/pdf"],
    [{ name: "photo.jpg", type: "image/jpeg" }, "image/jpeg"],
    [{ name: "photo.jpeg", type: "image/jpeg" }, "image/jpeg"],
    [{ name: "photo.png", type: "image/png" }, "image/png"],
    [{ name: "photo.webp", type: "image/webp" }, "image/webp"],
    [{ name: "photo.png", type: "application/octet-stream" }, "image/png"],
  ])("accepts supported file %#", (file, expectedType) => {
    expect(getSupportedSkeapDocumentType(file)).toBe(expectedType);
  });

  it.each([
    { name: "certificate.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    { name: "photo.webp", type: "image/png" },
    { name: "photo.jpg", type: "image/png" },
    { name: "photo.png", type: "image/svg+xml" },
  ])("rejects unsupported file $name", (file) => {
    expect(getSupportedSkeapDocumentType(file)).toBeNull();
  });
});

describe("KK identity document mapping", () => {
  it("keeps the two valid ID sides distinct from other upload requirements", () => {
    expect(normalizeUploadRequirement("kkIdFront")).toBe(SKEAP_UPLOAD_KEY.KK_ID_FRONT);
    expect(normalizeUploadRequirement("kkIdBack")).toBe(SKEAP_UPLOAD_KEY.KK_ID_BACK);
  });
});

describe("SKEAP upload verification state", () => {
  it("requires the mandatory online documents to be pre-screened before pre-qualification", () => {
    const uploads = {
      enrollmentCertificate: { url: "https://example.com/enrollment.pdf", verified: true },
      gradeReport: { url: "https://example.com/grades.pdf", verified: true },
      incomeCertificate: { url: "https://example.com/income.pdf", verified: true },
    };

    expect(areRequiredSkeapDocumentsPreScreened(uploads)).toBe(true);
    expect(areRequiredSkeapDocumentsPreScreened({
      ...uploads,
      gradeReport: { ...uploads.gradeReport, verified: false },
    })).toBe(false);
    expect(areRequiredSkeapDocumentsPreScreened({
      ...uploads,
      voterCertificate: { url: "https://example.com/voter.pdf", verified: false },
    })).toBe(false);
  });

  it("preserves verification state when normalizing uploaded files", () => {
    expect(normalizeUploadedFiles({
      voterCertificate: {
        url: "https://example.com/voter-certificate.png",
        name: "voter-certificate.png",
        verificationStatus: "AUTO_VERIFIED",
      },
    })).toEqual({
      voterCertificate: {
        url: "https://example.com/voter-certificate.png",
        name: "voter-certificate.png",
        verificationStatus: "AUTO_VERIFIED",
      },
    });
  });

  it("exposes persisted OCR verification state on upload groups", () => {
    expect(getUploadGroups({
      voterCertificate: {
        url: "https://example.com/voter-certificate.png",
        verificationStatus: "PENDING_ADMIN_REVIEW",
      },
    })).toContainEqual(expect.objectContaining({
      key: "voterCertificate",
      verificationStatus: "PENDING_ADMIN_REVIEW",
    }));
  });

  it("rejects unknown OCR verification statuses", () => {
    expect(normalizeUploadedFiles({
      voterCertificate: {
        url: "https://example.com/voter-certificate.png",
        verificationStatus: "VERIFIED_BY_ADMIN",
      },
    })).toBeNull();
  });

  it("preserves manual review flags for administrative upload groups", () => {
    expect(getUploadGroups({
      voterCertificate: {
        url: "https://example.com/voter-certificate.png",
        name: "voter-certificate.png",
        manualReview: true,
      },
    })).toContainEqual(expect.objectContaining({
      key: "voterCertificate",
      manualReview: true,
    }));
  });

  it("preserves OCR status but omits private remarks in applicant uploads", () => {
    expect(getApplicantUploadedFiles({
      voterCertificate: {
        url: "https://example.com/voter-certificate.png",
        name: "voter-certificate.png",
        verificationStatus: "AUTO_VERIFIED",
        adminRemark: "Needs a clearer scan",
      },
    })).toEqual({
      voterCertificate: {
        url: "https://example.com/voter-certificate.png",
        name: "voter-certificate.png",
        verificationStatus: "AUTO_VERIFIED",
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
          documentLabel: "Certificate of Low-Income",
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
