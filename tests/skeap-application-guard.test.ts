import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildIdentityFingerprint,
  findBanWatchlistMatch,
  DEFAULT_ACTIVE_SKEAP_EDUCATION_LEVELS,
  getActiveSkeapEducationLevels,
  getSkeapEducationLevelGuardError,
  getSkeapReapplicationEligibility,
  getSkeapSubmissionGuardError,
  isPermanentlyBarredFromSkeap,
} from "@/lib/skeap-application-guard";
import { handleSkeapApply } from "@/lib/skeap-application-client";
import { SKEAP_UPLOAD_KEY } from "@/lib/skeap-upload";

describe("getSkeapEducationLevelGuardError", () => {
  it("allows categories enabled for the cycle and rejects inactive Tech-Voc", () => {
    expect(getSkeapEducationLevelGuardError("College")).toBeNull();
    expect(getSkeapEducationLevelGuardError("Technical and Vocational (Tech-Voc)"))
      .toContain("not open for the current SKEAP cycle");
    expect(getSkeapEducationLevelGuardError(
      "Technical and Vocational (Tech-Voc)",
      ["JUNIOR_HIGH", "TECH_VOC"],
    )).toBeNull();
  });
});

describe("getActiveSkeapEducationLevels", () => {
  it("normalizes configured enum keys and display labels", async () => {
    await expect(getActiveSkeapEducationLevels(async () => [
      "COLLEGE",
      "Technical and Vocational (Tech-Voc)",
      "COLLEGE",
    ])).resolves.toEqual(["COLLEGE", "TECH_VOC"]);
  });

  it("uses the default categories when lookup is empty or fails", async () => {
    await expect(getActiveSkeapEducationLevels(async () => [])).resolves.toEqual(
      DEFAULT_ACTIVE_SKEAP_EDUCATION_LEVELS,
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getActiveSkeapEducationLevels(async () => {
      throw new Error("config unavailable");
    })).resolves.toEqual(DEFAULT_ACTIVE_SKEAP_EDUCATION_LEVELS);
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });
});

describe("handleSkeapApply", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("SKEAP identity disqualification matching", () => {
    const barredRecord = {
      id: "revoked-1",
      userId: "previous-user",
      kkProfileId: "previous-profile",
      identityFingerprint: null,
      isPermanentlyDisqualified: true,
      reason: "Acts unbecoming",
      fullName: "Doe, Jane Marie",
      revokedAt: "2025-06-01T00:00:00.000Z",
      firstName: "Jane",
      middleName: "Marie",
      lastName: "Doe",
      dateOfBirth: new Date("2008-07-14T00:00:00.000Z"),
    };

    it("normalizes the exact civil-registry key and loose last-name/date key", () => {
      expect(buildIdentityFingerprint({
        firstName: " Jane-Anne ",
        middleName: "M. Marie",
        lastName: " D'oe ",
        dateOfBirth: new Date("2008-07-14T00:00:00.000Z"),
      })).toEqual({
        exact: "DOE|JANEANNE|MMARIE|2008-07-14",
        loose: "DOE|2008-07-14",
      });
    });

    it("blocks direct, linked-profile, and exact-identity matches", () => {
      expect(getSkeapReapplicationEligibility([barredRecord], {
        userId: "previous-user",
      })).toMatchObject({ eligible: false, reason: "PERMANENTLY_DISQUALIFIED" });
      expect(getSkeapReapplicationEligibility([barredRecord], {
        userId: "new-user",
        kkProfileId: "previous-profile",
      })).toMatchObject({ eligible: false, reason: "PERMANENTLY_DISQUALIFIED" });
      expect(getSkeapReapplicationEligibility([barredRecord], {
        userId: "new-user",
        firstName: "Jane",
        middleName: "Marie",
        lastName: "Doe",
        dateOfBirth: "2008-07-14",
      })).toMatchObject({
        eligible: false,
        reason: "PERMANENTLY_DISQUALIFIED",
        message: expect.stringContaining("permanently ineligible"),
      });
      expect(getSkeapReapplicationEligibility([barredRecord], {
        userId: "another-user",
        firstName: "John",
        lastName: "Smith",
        dateOfBirth: "2008-07-14",
      })).toEqual({ eligible: true });
    });

    it("returns a watchlist record for last-name/date or first-and-last near matches only", () => {
      expect(findBanWatchlistMatch([barredRecord], {
        userId: "new-user",
        firstName: "Janet",
        lastName: "Doe",
        dateOfBirth: "2008-07-14",
      })).toMatchObject({ id: "revoked-1", fullName: "Doe, Jane Marie" });
      expect(findBanWatchlistMatch([barredRecord], {
        userId: "new-user",
        firstName: "Jane",
        lastName: "Doe",
        dateOfBirth: "2009-01-01",
      })).toMatchObject({ id: "revoked-1" });
      expect(findBanWatchlistMatch([barredRecord], {
        userId: "new-user",
        firstName: "Jane",
        middleName: "Marie",
        lastName: "Doe",
        dateOfBirth: "2008-07-14",
      })).toBeNull();
    });
  });

  describe("isPermanentlyBarredFromSkeap", () => {
    it("uses the explicit disqualification flag and legacy reason text", () => {
      expect(isPermanentlyBarredFromSkeap({ isPermanentlyDisqualified: true, reason: "Low GWA" })).toBe(true);
      expect(isPermanentlyBarredFromSkeap({ isPermanentlyDisqualified: false, reason: "Act unbecoming of a student" })).toBe(true);
      expect(isPermanentlyBarredFromSkeap({ isPermanentlyDisqualified: false, reason: "Criminal act" })).toBe(true);
      expect(isPermanentlyBarredFromSkeap({ isPermanentlyDisqualified: false, reason: "Tampered or falsified documents" })).toBe(true);
      expect(isPermanentlyBarredFromSkeap({ isPermanentlyDisqualified: false, reason: "Failed to maintain minimum GWA" })).toBe(false);
    });
  });

  describe("getSkeapSubmissionGuardError", () => {
    const requiredUploads = {
      [SKEAP_UPLOAD_KEY.FAMILY_INCOME]: { url: "income.pdf" },
      [SKEAP_UPLOAD_KEY.ENROLLMENT_CERT]: { url: "enrollment.pdf" },
      [SKEAP_UPLOAD_KEY.GRADE_REPORT]: { url: "grades.pdf" },
      [SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE]: { url: "voter.pdf" },
    };

    it("rejects applicants who are voting age and are not registered", () => {
      expect(getSkeapSubmissionGuardError({
        age: 18,
        registeredVoter: false,
        parentGuardianRegisteredVoter: false,
        parentGuardianVoterFullName: "",
        uploadedFiles: requiredUploads,
      })).toContain("Section 3(6)");
    });

    it("requires a registered parent or guardian and their full name for minors", () => {
      expect(getSkeapSubmissionGuardError({
        age: 17,
        registeredVoter: false,
        parentGuardianRegisteredVoter: true,
        parentGuardianVoterFullName: " ",
        uploadedFiles: requiredUploads,
      })).toContain("full name");
    });

    it("requires a parent or guardian voter name with at least three trimmed characters", () => {
      expect(getSkeapSubmissionGuardError({
        age: 17,
        registeredVoter: false,
        parentGuardianRegisteredVoter: true,
        parentGuardianVoterFullName: " A ",
        uploadedFiles: requiredUploads,
      })).toContain("at least 3 characters");
    });

    it.each([
      SKEAP_UPLOAD_KEY.FAMILY_INCOME,
      SKEAP_UPLOAD_KEY.ENROLLMENT_CERT,
      SKEAP_UPLOAD_KEY.GRADE_REPORT,
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE,
    ])("rejects submissions missing required upload %s", (missingKey) => {
      const uploadsMissingDocument: Record<string, { url: string }> = { ...requiredUploads };
      delete uploadsMissingDocument[missingKey];

      expect(getSkeapSubmissionGuardError({
        age: 18,
        registeredVoter: true,
        parentGuardianRegisteredVoter: false,
        parentGuardianVoterFullName: "",
        uploadedFiles: uploadsMissingDocument,
      })).toContain(missingKey);
    });

    it("requires a voter certificate from a minor applicant using the guardian route", () => {
      const uploadsMissingVoterCertificate: Record<string, { url: string }> = { ...requiredUploads };
      delete uploadsMissingVoterCertificate[SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE];

      expect(getSkeapSubmissionGuardError({
        age: 17,
        registeredVoter: false,
        parentGuardianRegisteredVoter: true,
        parentGuardianVoterFullName: "Parent Guardian",
        uploadedFiles: uploadsMissingVoterCertificate,
      })).toContain(SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE);
    });

    it("allows eligible submissions with all required uploads", () => {
      expect(getSkeapSubmissionGuardError({
        age: 17,
        registeredVoter: false,
        parentGuardianRegisteredVoter: true,
        parentGuardianVoterFullName: "Parent Guardian",
        uploadedFiles: requiredUploads,
      })).toBeNull();
    });
  });

  it("routes approved first-time applicants without a re-application toast", () => {
    const router = { push: vi.fn() };
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });

    handleSkeapApply("APPROVED", null, router, vi.fn());

    expect(router.push).toHaveBeenCalledWith("/programs/skeap/apply");
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("starts an approved application in place when an application callback is provided", () => {
    const router = { push: vi.fn() };
    const onApproved = vi.fn();
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });

    handleSkeapApply("APPROVED", null, router, vi.fn(), onApproved);

    expect(onApproved).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("allows rejected applicants to reapply without a revoked-grantee toast", () => {
    const router = { push: vi.fn() };
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });

    handleSkeapApply("APPROVED", "REJECTED", router, vi.fn());

    expect(router.push).toHaveBeenCalledWith("/programs/skeap/apply");
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("notifies revoked grantees before routing them to a new application", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const router = { push: vi.fn() };

    handleSkeapApply("APPROVED", "REVOKED", router, vi.fn());

    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          title: "Re-application Started",
          variant: "info",
          description: expect.stringContaining("resolved the grounds"),
        }),
      }),
    );
    expect(router.push).toHaveBeenCalledWith("/programs/skeap/apply");
  });

  it("does not allow a current grantee to start another application", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const router = { push: vi.fn() };
    const onApproved = vi.fn();

    handleSkeapApply("APPROVED", "ACTIVE", router, vi.fn(), onApproved);

    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          title: "Application unavailable",
          variant: "warning",
        }),
      }),
    );
    expect(onApproved).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opens verification for pending profiles without navigating", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const router = { push: vi.fn() };
    const setShowVerificationModal = vi.fn();

    handleSkeapApply("PENDING", null, router, setShowVerificationModal);

    expect(setShowVerificationModal).toHaveBeenCalledWith(true);
    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("notifies rejected profiles and routes them to the helpdesk", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const router = { push: vi.fn() };

    handleSkeapApply("REJECTED", null, router, vi.fn());

    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          variant: "error",
          description: expect.stringContaining("not approved"),
        }),
      }),
    );
    expect(router.push).toHaveBeenCalledWith("/chatbot");
  });
});
