import type { CampaignSnapshot } from "@/lib/campaign-approval";

interface ApprovalEmailOptions {
  approvalUrl: string;
  snapshot: CampaignSnapshot;
  expiresAt: string;
  confirmationCode: string;
}

export function buildApprovalEmail({ approvalUrl, snapshot, expiresAt, confirmationCode }: ApprovalEmailOptions): {
  subject: string;
  html: string;
} {
  const expiry = new Date(expiresAt).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });

  const subject = `[AutoCDP] Campaign approval needed — ${snapshot.recipientCount} ${snapshot.channelLabel} recipients`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Campaign Approval Request</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td align="center" style="padding:40px 16px;">

  <table width="580" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;width:100%;">

    <!-- Header -->
    <tr>
      <td style="background:#1E293B;border-radius:12px 12px 0 0;padding:28px 36px;">
        <p style="margin:0;color:#94A3B8;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">AutoCDP</p>
        <h1 style="margin:8px 0 0;color:#F8FAFC;font-size:22px;font-weight:700;line-height:1.3;">
          Campaign Approval Request
        </h1>
        <p style="margin:6px 0 0;color:#94A3B8;font-size:14px;">
          ${snapshot.dealershipName}
        </p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="background:#FFFFFF;padding:32px 36px;">

        <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
          <strong style="color:#1E293B;">${snapshot.requestedByEmail}</strong> has requested your approval
          before sending a ${snapshot.channelLabel} campaign to
          <strong style="color:#1E293B;">${snapshot.recipientCount} customer${snapshot.recipientCount !== 1 ? "s" : ""}</strong>.
        </p>

        <!-- Campaign summary box -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="background:#F1F5F9;border-radius:8px;margin-bottom:24px;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94A3B8;">
                Campaign Summary
              </p>
              ${row("Channel", snapshot.channelLabel)}
              ${row("Recipients", `${snapshot.recipientCount} customers`)}
              ${row("Estimated Cost", snapshot.estimatedCost)}
              ${row("Campaign Goal", snapshot.campaignGoal.slice(0, 140) + (snapshot.campaignGoal.length > 140 ? "…" : ""))}
            </td>
          </tr>
        </table>

        <!-- Primary CTA -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;">
          <tr>
            <td align="center">
              <a href="${approvalUrl}"
                style="display:inline-block;background:#4F46E5;color:#FFFFFF;font-size:15px;font-weight:700;
                       text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                Review &amp; Approve Campaign →
              </a>
            </td>
          </tr>
        </table>

        <!-- Confirmation code box -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
          <tr>
            <td style="background:#EEF2FF;border:2px solid #6366F1;border-radius:10px;padding:20px 24px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6366F1;">
                Your Confirmation Code
              </p>
              <p style="margin:0;font-size:36px;font-weight:800;color:#1E293B;letter-spacing:10px;font-family:'Courier New',Courier,monospace;">
                ${confirmationCode}
              </p>
              <p style="margin:10px 0 0;font-size:12px;color:#64748B;line-height:1.5;">
                You will need to enter this code on the approval page to authorize sending.<br/>
                Do not share this code — it authorizes a campaign on behalf of ${snapshot.dealershipName}.
              </p>
            </td>
          </tr>
        </table>

        <!-- Security note -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;margin-bottom:24px;">
          <tr>
            <td style="padding:14px 18px;">
              <p style="margin:0;font-size:13px;color:#92400E;line-height:1.5;">
                <strong>⏰ Expires:</strong> ${expiry}<br/>
                This is a one-time link. The campaign will <strong>not send</strong> unless you explicitly approve it.
                If you did not expect this request, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:0;color:#CBD5E1;font-size:11px;line-height:1.5;">
          This approval request was sent by AutoCDP on behalf of ${snapshot.dealershipName}.
          Approving this campaign creates a permanent audit record including your name, email, IP address, and timestamp.
        </p>

      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background:#F1F5F9;border-radius:0 0 12px 12px;padding:16px 36px;text-align:center;">
        <p style="margin:0;color:#94A3B8;font-size:11px;">
          AutoCDP · Campaign Management Platform<br/>
          Approval ID: <code style="font-family:monospace;">${approvalUrl.split("/").pop()?.slice(0, 12) ?? ""}&hellip;</code>
        </p>
      </td>
    </tr>

  </table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}

function row(label: string, value: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px;">
    <tr>
      <td style="width:120px;font-size:12px;font-weight:600;color:#64748B;vertical-align:top;padding-right:12px;">${label}</td>
      <td style="font-size:13px;color:#1E293B;vertical-align:top;">${value}</td>
    </tr>
  </table>`;
}
