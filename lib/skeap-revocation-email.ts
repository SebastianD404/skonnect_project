import { createGmailTransporter, sendTransactionalEmail } from "@/lib/broadcast-email";

type RevocationRecipient = {
  email: string;
  fullName: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toTitleCaseName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_match, separator: string, letter: string) =>
      `${separator}${letter.toLocaleUpperCase()}`
    );
}

function buildRevocationEmailHtml({
  recipientName,
  reason,
  additionalNotes,
}: {
  recipientName: string;
  reason: string;
  additionalNotes: string | null;
}) {
  const notes = additionalNotes?.trim();
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Official SKEAP Scholarship Notice</title>
  </head>
  <body style="margin:0;background:#f1f5f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;border:1px solid #dbe3ec;border-radius:12px;background:#ffffff;border-collapse:separate;overflow:hidden;">
      <tr>
        <td style="padding:24px 32px;background:#0f3d5c;color:#ffffff;border-bottom:4px solid #16a3b8;">
          <p style="margin:0;color:#b9e8ed;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Sangguniang Kabataan · Barangay Pico</p>
          <h1 style="margin:12px 0 0;font-size:22px;line-height:1.3;color:#ffffff;">Official SKEAP Scholarship Notice</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px;font-size:15px;line-height:1.7;">
          <p style="margin:0 0 16px;">Dear ${escapeHtml(recipientName)},</p>
          <p style="margin:0 0 20px;">This is an official notice from the Sangguniang Kabataan of Barangay Pico. We regret to inform you that your SKEAP scholarship has been discontinued, effective immediately.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 auto 20px;border:1px solid #f1c7ce;border-radius:10px;background:#fff7f7;border-collapse:separate;">
            <tr>
              <td style="padding:18px 20px;text-align:center;">
                <p style="margin:0 0 6px;color:#7f1d1d;font-size:14px;font-weight:700;">Grounds for Discontinuance</p>
                <p style="margin:0;color:#334155;">${escapeHtml(reason)}</p>
                ${notes ? `<p style="margin:16px 0 0;color:#7f1d1d;font-size:14px;font-weight:700;">Remarks</p><p style="margin:4px 0 0;color:#334155;">${escapeHtml(notes)}</p>` : ""}
              </td>
            </tr>
          </table>
          <p style="margin:0 0 16px;">Your record has been transferred to Revoked Grantees in accordance with Barangay Ordinance No. 1.</p>
          <p style="margin:0 0 20px;">If you believe this decision was made in error or wish to request a review, please visit the SK Office at the Barangay Pico Hall.</p>
          <p style="margin:0;">Respectfully,<br><strong>Sangguniang Kabataan</strong><br>Barangay Pico</p>
        </td>
      </tr>
      <tr>
        <td style="border-top:1px solid #e2e8f0;padding:16px 32px;color:#64748b;font-size:12px;line-height:1.5;">
          Official correspondence from the Sangguniang Kabataan of Barangay Pico through SKonnect.
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendSkeapRevocationEmail({
  granteeId,
  recipient,
  reason,
  additionalNotes,
}: {
  granteeId: string;
  recipient: RevocationRecipient;
  reason: string;
  additionalNotes: string | null;
}) {
  const recipientName = toTitleCaseName(recipient.fullName);
  const notes = additionalNotes?.trim() || null;
  const bodyText = [
    `Dear ${recipientName},`,
    "",
    "This is an official notice from the Sangguniang Kabataan of Barangay Pico. We regret to inform you that your SKEAP scholarship has been discontinued, effective immediately.",
    "",
    "Grounds for Discontinuance:",
    reason,
    ...(notes ? ["", "Remarks:", notes] : []),
    "",
    "Your record has been transferred to Revoked Grantees in accordance with Barangay Ordinance No. 1.",
    "",
    "If you believe this decision was made in error or wish to request a review, please visit the SK Office at the Barangay Pico Hall.",
    "",
    "Respectfully,",
    "Sangguniang Kabataan",
    "Barangay Pico",
  ].join("\n");

  const transporter = createGmailTransporter();
  await sendTransactionalEmail(
    transporter,
    recipient.email,
    "Official Notice: SKEAP Scholarship Discontinuance",
    bodyText,
    `revocation-${granteeId}`,
    buildRevocationEmailHtml({
      recipientName,
      reason,
      additionalNotes: notes,
    }),
  );
}
