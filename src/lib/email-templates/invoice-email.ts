import type { Invoice, InvoiceLineItem, BillingSettings } from "@/lib/billing/invoices";

interface InvoiceEmailOptions {
  invoice: Invoice;
  dealerName: string;
  billingSettings: BillingSettings;
  dealerAddress?: string;
}

export function buildInvoiceEmail({
  invoice,
  dealerName,
  billingSettings,
  dealerAddress,
}: InvoiceEmailOptions): { subject: string; html: string } {
  const monthName = new Date(invoice.billing_year, invoice.billing_month - 1)
    .toLocaleString("en-US", { month: "long" });

  const subject = `Invoice ${invoice.invoice_number} — ${monthName} ${invoice.billing_year} — $${fmt(invoice.subtotal_cents)}`;

  const pref = billingSettings.payment_method_preference;
  const lineItemRows = (invoice.line_items as InvoiceLineItem[]).map((li) => `
    <tr>
      <td style="padding:10px 16px;font-size:13px;color:#374151;border-bottom:1px solid #F3F4F6;line-height:1.4;">${li.description}</td>
      <td style="padding:10px 16px;font-size:13px;color:#374151;text-align:center;border-bottom:1px solid #F3F4F6;">${li.quantity.toLocaleString()}</td>
      <td style="padding:10px 16px;font-size:13px;color:#374151;text-align:right;border-bottom:1px solid #F3F4F6;">${li.unit_cents === 0 ? "Included" : `$${fmt(li.unit_cents)}`}</td>
      <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;text-align:right;border-bottom:1px solid #F3F4F6;">$${fmt(li.total_cents)}</td>
    </tr>
  `).join("");

  const paymentBlock = pref === "ach"
    ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;margin-bottom:24px;">
        <tr><td style="padding:18px 22px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1E40AF;">ACH Payment Instructions</p>
          ${billingSettings.ach_bank_name ? `<p style="margin:0 0 4px;font-size:13px;color:#1E40AF;">Bank: ${billingSettings.ach_bank_name}</p>` : ""}
          ${billingSettings.ach_account_last4 ? `<p style="margin:0 0 4px;font-size:13px;color:#1E40AF;">Account: ···${billingSettings.ach_account_last4}</p>` : ""}
          ${billingSettings.ach_routing_last4 ? `<p style="margin:0 0 4px;font-size:13px;color:#1E40AF;">Routing: ···${billingSettings.ach_routing_last4}</p>` : ""}
          <p style="margin:10px 0 0;font-size:12px;color:#3B82F6;">Please include invoice number <strong>${invoice.invoice_number}</strong> in the payment reference.</p>
        </td></tr>
      </table>`
    : `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;margin-bottom:24px;">
        <tr><td style="padding:18px 22px;text-align:center;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#166534;">Pay by Credit or Debit Card</p>
          <p style="margin:0 0 14px;font-size:12px;color:#16A34A;">Your card on file will be charged on the due date. Log in to update your payment method.</p>
          <a href="https://autocdp.com/dashboard/billing" style="display:inline-block;background:#16A34A;color:#fff;font-size:13px;font-weight:700;text-decoration:none;padding:10px 28px;border-radius:6px;">Manage Payment Method</a>
        </td></tr>
      </table>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><title>Invoice ${invoice.invoice_number}</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="background:#1E293B;border-radius:12px 12px 0 0;padding:28px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td>
          <p style="margin:0;color:#94A3B8;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">AutoCDP</p>
          <p style="margin:6px 0 0;color:#F8FAFC;font-size:20px;font-weight:700;">Invoice</p>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <p style="margin:0;color:#94A3B8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Invoice #</p>
          <p style="margin:4px 0 0;color:#F8FAFC;font-size:14px;font-weight:700;font-family:monospace;">${invoice.invoice_number}</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Meta row -->
  <tr><td style="background:#F1F5F9;padding:16px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="width:33%;">
          <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;">Bill To</p>
          <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#1E293B;">${dealerName}</p>
          ${dealerAddress ? `<p style="margin:2px 0 0;font-size:11px;color:#64748B;">${dealerAddress}</p>` : ""}
        </td>
        <td style="width:33%;text-align:center;">
          <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;">Period</p>
          <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#1E293B;">${monthName} ${invoice.billing_year}</p>
        </td>
        <td style="width:33%;text-align:right;">
          <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;">Due Date</p>
          <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#1E293B;">
            ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Net 15"}
          </p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Line items -->
  <tr><td style="background:#FFFFFF;padding:28px 36px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
      <thead>
        <tr style="background:#F8FAFC;">
          <th style="padding:8px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748B;text-align:left;border-bottom:2px solid #E2E8F0;">Description</th>
          <th style="padding:8px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748B;text-align:center;border-bottom:2px solid #E2E8F0;">Qty</th>
          <th style="padding:8px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748B;text-align:right;border-bottom:2px solid #E2E8F0;">Unit</th>
          <th style="padding:8px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748B;text-align:right;border-bottom:2px solid #E2E8F0;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemRows}
      </tbody>
    </table>
  </td></tr>

  <!-- Total -->
  <tr><td style="background:#FFFFFF;padding:0 36px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:4px;">
      <tr>
        <td></td>
        <td style="width:180px;padding:14px 16px;background:#F1F5F9;border-radius:0 0 8px 8px;text-align:right;">
          <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748B;">Total Due</p>
          <p style="margin:4px 0 0;font-size:26px;font-weight:800;color:#0F172A;">$${fmt(invoice.subtotal_cents)}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#94A3B8;">USD · ${pref === "ach" ? "ACH transfer" : "Credit card"}</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Payment instructions -->
  <tr><td style="background:#FFFFFF;padding:0 36px 28px;">
    ${paymentBlock}
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#F1F5F9;border-radius:0 0 12px 12px;padding:16px 36px;text-align:center;">
    <p style="margin:0;color:#94A3B8;font-size:11px;">
      AutoCDP · Campaign Management Platform<br/>
      Questions? Reply to this email or visit <a href="https://autocdp.com/dashboard/billing" style="color:#6366F1;">autocdp.com/dashboard/billing</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}

function fmt(cents: number): string {
  return (cents / 100).toFixed(2);
}
