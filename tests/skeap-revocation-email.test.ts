import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createGmailTransporter: vi.fn(),
  sendTransactionalEmail: vi.fn(),
  transporter: { sendMail: vi.fn() },
}));

vi.mock("@/lib/broadcast-email", () => ({
  createGmailTransporter: mocks.createGmailTransporter,
  sendTransactionalEmail: mocks.sendTransactionalEmail,
}));

import { sendSkeapRevocationEmail } from "@/lib/skeap-revocation-email";

describe("SKEAP revocation email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createGmailTransporter.mockReturnValue(mocks.transporter);
    mocks.sendTransactionalEmail.mockResolvedValue(undefined);
  });

  it("sends a formal notice with title-cased name and escaped callout content", async () => {
    await sendSkeapRevocationEmail({
      granteeId: "grantee-1",
      recipient: {
        email: "student@example.com",
        fullName: "ALDRIN-JAY O'NEIL ACOSTA",
      },
      reason: "Became a grantee of another scholarship agency",
      additionalNotes: "<script>review</script>",
      isPermanentlyDisqualified: false,
    });

    const [transporter, recipient, subject, text, referenceId, html] =
      mocks.sendTransactionalEmail.mock.calls[0];
    expect(transporter).toBe(mocks.transporter);
    expect(recipient).toBe("student@example.com");
    expect(subject).toBe("Official Notice: SKEAP Scholarship Discontinuance");
    expect(referenceId).toBe("revocation-grantee-1");
    expect(text).toContain("Dear Aldrin-Jay O'Neil Acosta,");
    expect(text).toContain("effective immediately.");
    expect(text).toContain("Grounds for Discontinuance:");
    expect(text).toContain("Remarks:\n<script>review</script>");
    expect(text).toContain("This action applies to your current SKEAP scholarship grant in accordance with Barangay Pico SKEAP program guidelines.");
    expect(text).not.toContain("Your record has been transferred to Revoked Grantees");
    expect(text).not.toContain("Barangay Ordinance No. 1");
    expect(text).toContain("please visit the SK Office at the Barangay Pico Hall.");
    expect(text).toContain("Sangguniang Kabataan\nBarangay Pico");
    expect(html).toContain("<strong>Sangguniang Kabataan</strong>");
    expect(html).toContain("Grounds for Discontinuance");
    expect(html).toContain("&lt;script&gt;review&lt;/script&gt;");
    expect(html).not.toContain("<script>review</script>");
    expect(html).toContain("This action applies to your current SKEAP scholarship grant in accordance with Barangay Pico SKEAP program guidelines.");
    expect(html).not.toContain("Your record has been transferred to Revoked Grantees");
    expect(html).not.toContain("Barangay Ordinance No. 1");
  });

  it("omits the remarks line when additional notes are empty", async () => {
    await sendSkeapRevocationEmail({
      granteeId: "grantee-2",
      recipient: { email: "student@example.com", fullName: "ALDRIN JAY ACOSTA" },
      reason: "Tampered or falsified documents",
      additionalNotes: "  ",
      isPermanentlyDisqualified: false,
    });

    const [, , , text, , html] = mocks.sendTransactionalEmail.mock.calls[0];
    expect(text).not.toContain("Remarks:");
    expect(html).not.toContain(">Remarks</p>");
  });

  it("uses permanent-disqualification guidance in both email formats", async () => {
    await sendSkeapRevocationEmail({
      granteeId: "grantee-3",
      recipient: { email: "student@example.com", fullName: "ALDRIN JAY ACOSTA" },
      reason: "Committed acts unbecoming of a student",
      additionalNotes: null,
      isPermanentlyDisqualified: true,
    });

    const [, , , text, , html] = mocks.sendTransactionalEmail.mock.calls[0];
    const guidance = "Please note that due to the nature of this violation, your account has been permanently disqualified from future SKEAP scholarship cycles in accordance with Barangay Pico SKEAP guidelines.";
    expect(text).toContain(guidance);
    expect(html).toContain(guidance);
    expect(text).toContain("If you believe this decision was made in error or wish to request a review, please visit the SK Office at the Barangay Pico Hall.");
    expect(html).toContain("If you believe this decision was made in error or wish to request a review, please visit the SK Office at the Barangay Pico Hall.");
  });
});
