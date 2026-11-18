import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildExitClearanceReturnedEmail,
  buildGranteeApprovalEmail,
  buildSubmissionReviewEmail,
} from "@/lib/broadcast-email";
import { writeGranteeSubmissionNotification } from "@/lib/grantee-submission-notifications";

const commonInput = {
  granteeFullName: "Kai Santos",
  semesterLabel: "2026-2027 Second Semester",
};

describe("submission review emails", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://skonnect.example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds the official branded SKEAP grantee approval email", () => {
    const email = buildGranteeApprovalEmail({
      to: "scholar@example.com",
      applicantName: "Kai Santos",
      academicYear: "2026-2027",
      semester: "Second Semester",
      dashboardUrl: "https://skonnect.example/",
    });

    expect(email.subject).toBe(
      "Congratulations! SKEAP Scholarship Approved (2026-2027 Second Semester) - SKonnect",
    );
    expect(email.html).toContain("SANGGUNIANG KABATAAN · BARANGAY PICO");
    expect(email.html).toContain("Official SKEAP Grantee Approval");
    expect(email.html).toContain("Hello Kai Santos,");
    expect(email.html).toContain("Academic Year");
    expect(email.html).toContain("Status");
    expect(email.html).toContain("Active Grantee");
    expect(email.html).toContain("80% or above (or passing mark) across all subjects");
    expect(email.html).toContain("no failing grade in any single subject");
    expect(email.html).toContain('href="https://skonnect.example/"');
    expect(email.html).toContain("Open Grantee Workspace →");
  });

  it("renders the physical CTC instructions and a clean submission link", () => {
    const email = buildSubmissionReviewEmail({
      ...commonInput,
      stage: "FOR_PHYSICAL_CTC",
    });

    expect(email.subject).toBe("Action Required: Submit Original / CTC");
    expect(email.html).toContain("SKONNECT · SKEAP");
    expect(email.html).toContain("Dear Kai Santos,");
    expect(email.html).toContain(
      "Your digital documents for 2026-2027 Second Semester have passed initial review. To complete your final verification, please present your physical documents at the Barangay Pico SK Office.",
    );
    expect(email.html).toContain("Physical Verification Details");
    expect(email.html).toContain("Original or Certified True Copy (CTC) of Grade Report &amp; Certificate of Enrollment");
    expect(email.html).toContain("Barangay Pico SK Office, La Trinidad, Benguet");
    expect(email.html).toContain('href="https://skonnect.example/grantee-dashboard/documents"');
    expect(email.html).toContain("View Submission in SKonnect");
    expect(email.html).toContain("Sangguniang Kabataan of Barangay Pico · La Trinidad, Benguet");
    expect(email.html).not.toContain("SKEAP status update");
  });

  it.each([
    "FOR_PHYSICAL_CTC",
    "RETURNED_FOR_EDITS",
    "FULLY_CLEARED",
  ] as const)("omits reviewer notes when empty for %s", (stage) => {
    const email = buildSubmissionReviewEmail({
      ...commonInput,
      stage,
      documentLabel: "Certificate of Enrollment",
      reviewerNotes: " \n ",
    });

    expect(email.html).not.toContain("REVIEWER NOTES");
    expect(email.text).not.toContain("REVIEWER NOTES");
    expect(email.html).not.toContain("No additional reviewer notes were provided.");
    expect(email.text).not.toContain("No additional reviewer notes were provided.");
  });

  it("renders non-empty reviewer notes in a labeled callout and escapes them", () => {
    const email = buildSubmissionReviewEmail({
      ...commonInput,
      stage: "RETURNED_FOR_EDITS",
      documentLabel: "Grade Report",
      reviewerNotes: "Please correct <the term>.",
    });

    expect(email.html).toContain("background:#f8fafc;border-left:3px solid #0f766e;padding:12px 14px;border-radius:8px;");
    expect(email.html).toContain("REVIEWER NOTES");
    expect(email.html).toContain("Please correct &lt;the term&gt;.");
    expect(email.text).toContain("REVIEWER NOTES\nPlease correct <the term>.");
  });

  it("builds a branded exit-clearance return email with an escaped reason and dashboard button", () => {
    const email = buildExitClearanceReturnedEmail({
      granteeFullName: "Kai Santos",
      remarks: "Please replace the <blurred> scan & include the signature.",
      dashboardUrl: "https://skonnect.example/grantee-dashboard",
    });

    expect(email.subject).toBe("Action Required: Re-upload Your SKEAP Exit Clearance");
    expect(email.text).toContain("Reason from SK Admin:\nPlease replace the <blurred> scan & include the signature.");
    expect(email.html).toContain("Please replace the &lt;blurred&gt; scan &amp; include the signature.");
    expect(email.html).toContain('href="https://skonnect.example/grantee-dashboard"');
    expect(email.html).toContain("Open Grantee Dashboard");
    expect(email.text).not.toContain("....");
  });

  it("omits empty reviewer notes from in-app notifications", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const notification = { upsert } as unknown as Parameters<typeof writeGranteeSubmissionNotification>[0];

    await writeGranteeSubmissionNotification(notification, {
      stage: "returned",
      submissionId: "submission-1",
      userId: "grantee-1",
      semester: "2026-2027 Second Semester",
      documentLabel: "Grade Report",
      reviewerNotes: " \n ",
    });

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        message: "Action Required: Update 2026-2027 Second Semester Grade Report\n\nYour 2026-2027 Second Semester Grade Report was returned for edits.",
      }),
    }));
    expect(upsert.mock.calls[0][0].create.message).not.toContain("Reviewer notes:");
    expect(upsert.mock.calls[0][0].create.message).not.toContain("No additional reviewer notes were provided.");
  });
});
