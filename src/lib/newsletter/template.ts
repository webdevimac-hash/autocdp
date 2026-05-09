/**
 * Renders the monthly newsletter as a brand-safe HTML email.
 * Uses table-based inline-style layout for broad email client compatibility.
 */
import type { NewsletterSection } from "./types";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://autocdp.com").replace(/\/$/, "");

export function makeRsvpToken(
  newsletterId: string,
  customerId: string,
  eventKey: string
): string {
  return Buffer.from(
    JSON.stringify({ n: newsletterId, c: customerId, e: eventKey })
  ).toString("base64url");
}

export function parseRsvpToken(
  token: string
): { newsletterId: string; customerId: string; eventKey: string } | null {
  try {
    const { n, c, e } = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    if (!n || !c || !e) return null;
    return { newsletterId: n, customerId: c, eventKey: e };
  } catch {
    return null;
  }
}

function section(content: string): string {
  return `
    <tr><td style="padding:0 0 24px">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="background:#ffffff;border-radius:12px;border:1px solid #E2E8F0;padding:28px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
          ${content}
        </td></tr>
      </table>
    </td></tr>`;
}

function sectionLabel(text: string, color: string): string {
  return `<p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${color}">${text}</p>`;
}

function h2(text: string): string {
  return `<h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0F172A;line-height:1.3">${text}</h2>`;
}

function body(text: string): string {
  return `<p style="margin:0;font-size:15px;line-height:1.7;color:#334155">${text.replace(/\n/g, "<br>")}</p>`;
}

function ctaButton(label: string, url: string, bg = "#4F46E5"): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:20px">
    <tr><td style="background:${bg};border-radius:8px">
      <a href="${url}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">${label}</a>
    </td></tr>
  </table>`;
}

function renderSection(
  s: NewsletterSection,
  newsletterId: string,
  customerId: string
): string {
  switch (s.type) {
    case "arrivals": {
      const vehicleList = s.vehicles?.length
        ? `<ul style="margin:12px 0 0;padding:0 0 0 20px;color:#475569;font-size:14px;line-height:1.8">${s.vehicles.map((v) => `<li>${v}</li>`).join("")}</ul>`
        : "";
      return section(
        sectionLabel("🚗  New Arrivals", "#6366F1") +
        h2(s.title) +
        body(s.body) +
        vehicleList
      );
    }
    case "service_tip": {
      const cta =
        s.ctaText && s.ctaUrl ? ctaButton(s.ctaText, s.ctaUrl, "#0EA5E9") : "";
      return section(
        sectionLabel("🔧  Service Tip", "#0EA5E9") +
        h2(s.title) +
        body(s.tip) +
        cta
      );
    }
    case "event": {
      const token = makeRsvpToken(newsletterId, customerId, s.eventKey);
      const yesUrl = `${APP_URL}/api/rsvp?t=${token}&r=yes`;
      const noUrl  = `${APP_URL}/api/rsvp?t=${token}&r=no`;
      const meta = [
        s.date && `📅 ${s.date}`,
        s.time && `🕐 ${s.time}`,
        s.location && `📍 ${s.location}`,
      ]
        .filter(Boolean)
        .map((l) => `<p style="margin:4px 0;font-size:14px;color:#475569">${l}</p>`)
        .join("");
      const deadline = s.rsvpDeadline
        ? `<p style="margin:16px 0 0;font-size:12px;color:#94A3B8">RSVP by ${s.rsvpDeadline}</p>`
        : "";
      return section(
        sectionLabel("🎉  Event", "#F59E0B") +
        h2(s.title) +
        `<div style="margin-bottom:14px">${meta}</div>` +
        body(s.description) +
        deadline +
        `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:20px"><tr>
          <td style="background:#10B981;border-radius:8px;margin-right:8px">
            <a href="${yesUrl}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">✓ Count me in!</a>
          </td>
          <td style="width:8px"></td>
          <td style="background:#F1F5F9;border-radius:8px;border:1px solid #E2E8F0">
            <a href="${noUrl}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;color:#64748B;text-decoration:none">Can't make it</a>
          </td>
        </tr></table>`
      );
    }
    case "offer": {
      const expiry = s.expiresOn
        ? `<p style="margin:12px 0 0;font-size:12px;color:#94A3B8">Offer expires ${s.expiresOn}</p>`
        : "";
      return section(
        sectionLabel("🎁  Special Offer", "#8B5CF6") +
        h2(s.title) +
        body(s.body) +
        ctaButton(s.ctaText, `${APP_URL}/dashboard`, "#8B5CF6") +
        expiry
      );
    }
  }
}

export function renderNewsletterHtml(opts: {
  dealershipName: string;
  customerFirstName: string;
  subject: string;
  previewText: string;
  sections: NewsletterSection[];
  newsletterId: string;
  customerId: string;
  month: string;
}): string {
  const sectionsHtml = opts.sections
    .map((s) => renderSection(s, opts.newsletterId, opts.customerId))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${opts.subject}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">

<!-- Preview text -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${opts.previewText}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌</div>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC">
<tr><td align="center" style="padding:32px 16px 48px">
  <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">

    <!-- Header -->
    <tr><td style="padding:0 0 20px">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="background:linear-gradient(135deg,#1E3A5F 0%,#2563EB 100%);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,0.6)">${opts.month} Newsletter</p>
          <h1 style="margin:0;font-size:26px;font-weight:800;color:#FFFFFF;letter-spacing:-.02em">${opts.dealershipName}</h1>
        </td></tr>
      </table>
    </td></tr>

    <!-- Greeting -->
    <tr><td style="padding:0 0 20px">
      <p style="margin:0;font-size:16px;color:#334155;line-height:1.6">Hi ${opts.customerFirstName},</p>
      <p style="margin:8px 0 0;font-size:15px;color:#64748B;line-height:1.7">
        Here&rsquo;s your monthly update from ${opts.dealershipName}. We keep these short and friendly &mdash; just the highlights worth knowing.
      </p>
    </td></tr>

    <!-- Content sections -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${sectionsHtml}
    </table>

    <!-- Footer -->
    <tr><td style="padding:24px 0 0;text-align:center;border-top:1px solid #E2E8F0">
      <p style="margin:0 0 8px;font-size:13px;color:#94A3B8">You&rsquo;re receiving this because you&rsquo;re a valued customer of ${opts.dealershipName}.</p>
      <p style="margin:0;font-size:12px;color:#CBD5E1">
        Questions? Reply to this email or call us directly.
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}
