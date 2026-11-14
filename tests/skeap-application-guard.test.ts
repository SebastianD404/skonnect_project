import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSkeapSubmissionGuardError,
  handleSkeapApply,
} from "@/lib/skeap-application-guard";
import { SKEAP_UPLOAD_KEY } from "@/lib/skeap-upload";

describe("handleSkeapApply", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
