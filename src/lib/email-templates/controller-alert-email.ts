interface ControllerAlertOptions {
  dealerName: string;
  controllerEmail: string;
  printPieces: number;
  printCostCents: number;
  thresholdCents: number;
  currentMonthSpendCents: number;
  channel: string;
  requestedByEmail: string;
  billingPageUrl?: string;
}

export function buildControllerAlertEmail(opts: ControllerAlertOptions): { subject: string; html: string } {
  const {
    dealerName, printPieces, printCostCents, thresholdCents,
    currentMonthSpendCents, channel, requestedByEmail, billingPageUrl,
  } = opts;

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const portal = billingPageUrl ?? "https://autocdp.com/dashboard/billing";

  const subject = `[AutoCDP] Large campaign submitted — ${fmt(printCostCents)} for ${dealerName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><title>Controller Alert</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td align="center" style="padding:40px 16px;">
<table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;">

  <!-- Header -->
  <tr><td style="background:#1E293B;border-radius:12px 12px 0 0;padding:24px 32px;">
    <p style="margin:0;color:#94A3B8;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">AutoCDP · Controller Alert</p>
    <p style="margin:8px 0 0;color:#F8FAFC;font-size:19px;font-weight:700;">Large Campaign Submitted</p>
    <p style="margin:4px 0 0;color:#94A3B8;font-size:13px;">${dealerName}</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#FFFFFF;padding:28px 32px;">

    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
      This is an automatic notification. A campaign has been submitted that exceeds your
      spending alert threshold of <strong style="color:#1E293B;">${fmt(thresholdCents)}</strong>.
    </p>

    <!-- Stats box -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;border-right:1px solid #E2E8F0;text-align:center;width:33%;">
          <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;">Channel</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#1E293B;">${channel.replace(/_/g, " ")}</p>
        </td>
        <td style="padding:16px 20px;border-right:1px solid #E2E8F0;text-align:center;width:33%;">
          <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;">This Campaign</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#DC2626;">${fmt(printCostCents)}</p>
          ${printPieces > 0 ? `<p style="margin:2px 0 0;font-size:11px;color:#94A3B8;">${printPieces.toLocaleString()} pieces</p>` : ""}
        </td>
        <td style="padding:16px 20px;text-align:center;width:33%;">
          <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;">Month-to-Date</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#1E293B;">${fmt(currentMonthSpendCents)}</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:13px;color:#64748B;">
      Requested by: <strong style="color:#1E293B;">${requestedByEmail}</strong>
    </p>
    <p style="margin:0 0 24px;font-size:13px;color:#64748B;">
      The campaign has been approved by your GM and <strong>will proceed</strong> unless you take action.
      To pause or review billing, visit your billing dashboard.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
      <tr><td align="center">
        <a href="${portal}"
          style="display:inline-block;background:#4F46E5;color:#FFFFFF;font-size:14px;font-weight:700;
                 text-decoration:none;padding:12px 32px;border-radius:8px;">
          Review Billing Dashboard →
        </a>
      </td></tr>
    </table>

    <!-- Note box -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0;font-size:12px;color:#92400E;line-height:1.5;">
          You are receiving this because your email is configured as the billing controller for ${dealerName}.
          To adjust the alert threshold or unsubscribe, update your Invoice Settings in the billing dashboard.
        </p>
      </td></tr>
    </table>

  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#F1F5F9;border-radius:0 0 12px 12px;padding:14px 32px;text-align:center;">
    <p style="margin:0;color:#94A3B8;font-size:11px;">AutoCDP · Automated billing notification</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}
