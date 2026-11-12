import { describe, expect, it } from "vitest";
import { buildPayoutDisbursementHtml } from "@/lib/broadcast-email";

describe("payout disbursement email", () => {
  it("renders a styled receipt-confirmation email with the stipend amount and login action", () => {
    const html = buildPayoutDisbursementHtml({
      recipientName: "Kai Santos",
      semester: "2026-2027 First Semester",
      amount: 5000,
      confirmationUrl: "https://skonnect.example/login",
    });

    expect(html).toContain("max-width:448px");
    expect(html).toContain("background:#f8fafc");
    expect(html).toContain("2026-2027 First Semester");
    expect(html).toContain("₱5,000");
    expect(html).toContain("Log In to Confirm Payout");
    expect(html).toContain('href="https://skonnect.example/login"');
  });

  it("escapes untrusted recipient and semester values", () => {
    const html = buildPayoutDisbursementHtml({
      recipientName: "<img src=x onerror=alert(1)>",
      semester: 'Fall "Special"',
      amount: 5000,
      confirmationUrl: "https://skonnect.example/login",
    });

    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("Fall &quot;Special&quot;");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
  });
});
