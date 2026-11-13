import { describe, expect, it } from "vitest";
import { buildPayoutDisbursementHtml } from "@/lib/broadcast-email";

describe("payout disbursement email", () => {
  it("renders the payout period, exact amount, and receipt-confirmation action", () => {
    const html = buildPayoutDisbursementHtml({
      recipientName: "Kai Santos",
      semester: "2026-2027 First Semester",
      amount: 5000,
      confirmationUrl: "https://skonnect.example/login?next=%2Fgrantee%2Fpayouts",
    });

    expect(html).toContain("max-width:448px");
    expect(html).toContain("background:#f8fafc");
    expect(html).toContain("Academic year");
    expect(html).toContain(">2026-2027</p>");
    expect(html).toContain("Semester");
    expect(html).toContain(">First Semester</p>");
    expect(html).toContain("₱5,000");
    expect(html).toContain("Sign In to Confirm Receipt");
    expect(html).toContain('href="https://skonnect.example/login?next=%2Fgrantee%2Fpayouts"');
  });

  it("escapes untrusted recipient and semester values", () => {
    const html = buildPayoutDisbursementHtml({
      recipientName: "<img src=x onerror=alert(1)>",
      semester: 'Fall "Special"',
      amount: 5000,
      confirmationUrl: "https://skonnect.example/login?next=%2Fgrantee%2Fpayouts",
    });

    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("Fall &quot;Special&quot;");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
  });
});
