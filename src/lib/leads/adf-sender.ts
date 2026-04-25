/**
 * ADF outbound sender — generates ADF 1.0 XML and delivers to dealer CRMs.
 *
 * Supports:
 *   - ADF email delivery via Resend
 *   - HTTP POST to CRM endpoint (two-to-one routing: primary + fallback)
 *   - JSON lead format for modern API-based CRMs
 */

import { Resend } from "resend";
import type { ConquestLead } from "@/types";

// Lazy-initialize so the module can be imported at build time without a key
function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY ?? "");
}

// ── ADF XML builder ───────────────────────────────────────────

export interface AdfLeadData {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  address?: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  } | null;
  vehicleInterest?: string | null;
  comments?: string | null;
  source: string;
  externalId?: string | null;
}

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildAdfXml(lead: AdfLeadData, vendorName: string): string {
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  const idTag = lead.externalId
    ? `<id sequence="1" source="${esc(lead.source)}">${esc(lead.externalId)}</id>`
    : `<id sequence="1" source="${esc(lead.source)}"/>`;

  const phoneTag = lead.phone
    ? `<phone type="voice">${esc(lead.phone)}</phone>`
    : "";
  const emailTag = lead.email
    ? `<email>${esc(lead.email)}</email>`
    : "";

  const addr = lead.address;
  const addrTag = addr
    ? `<address>
        <street>${esc(addr.street ?? "")}</street>
        <city>${esc(addr.city ?? "")}</city>
        <state>${esc(addr.state ?? "")}</state>
        <postalcode>${esc(addr.zip ?? "")}</postalcode>
        <country>US</country>
      </address>`
    : "";

  const vehicleTag = lead.vehicleInterest
    ? `<vehicle interest="buy" status="used">
        <model>${esc(lead.vehicleInterest)}</model>
      </vehicle>`
    : "";

  const commentsTag = lead.comments
    ? `<comments>${esc(lead.comments)}</comments>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<?adf version="1.0"?>
<adf>
  <prospect status="new">
    ${idTag}
    <requestdate>${now}</requestdate>
    <vehicle interest="buy" status="used">
      ${vehicleTag ? "<model/>" : ""}
    </vehicle>
    ${vehicleTag}
    <customer>
      <contact>
        <name part="first">${esc(lead.firstName ?? "")}</name>
        <name part="last">${esc(lead.lastName ?? "")}</name>
        ${emailTag}
        ${phoneTag}
        ${addrTag}
      </contact>
      ${commentsTag}
    </customer>
    <vendor>
      <vendorname>${esc(vendorName)}</vendorname>
    </vendor>
  </prospect>
</adf>`;
}

// ── Delivery targets ──────────────────────────────────────────

export interface CrmDeliveryTarget {
  type: "email" | "http";
  /** For type=email: recipient address */
  toEmail?: string;
  /** For type=http: endpoint URL */
  endpointUrl?: string;
  /** Optional API key sent as Authorization: Bearer header */
  apiKey?: string;
  /** "adf" (XML) or "json" */
  format?: "adf" | "json";
}

export interface DeliveryResult {
  target: CrmDeliveryTarget;
  success: boolean;
  error?: string;
  statusCode?: number;
}

async function deliverViaEmail(
  xml: string,
  target: CrmDeliveryTarget,
  fromName: string,
  dealershipEmail: string
): Promise<DeliveryResult> {
  if (!target.toEmail) {
    return { target, success: false, error: "toEmail is required for email delivery" };
  }
  try {
    await getResend().emails.send({
      from: `${fromName} <${dealershipEmail}>`,
      to: target.toEmail,
      subject: "New Lead — ADF",
      text: "New ADF lead attached.",
      attachments: [
        {
          filename: "lead.xml",
          content: Buffer.from(xml).toString("base64"),
        },
      ],
    });
    return { target, success: true };
  } catch (err) {
    return { target, success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function deliverViaHttp(
  payload: string,
  contentType: string,
  target: CrmDeliveryTarget
): Promise<DeliveryResult> {
  if (!target.endpointUrl) {
    return { target, success: false, error: "endpointUrl is required for HTTP delivery" };
  }
  try {
    const headers: Record<string, string> = { "Content-Type": contentType };
    if (target.apiKey) headers["Authorization"] = `Bearer ${target.apiKey}`;

    const res = await fetch(target.endpointUrl, {
      method: "POST",
      headers,
      body: payload,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { target, success: false, statusCode: res.status, error: body.slice(0, 200) };
    }
    return { target, success: true, statusCode: res.status };
  } catch (err) {
    return { target, success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Two-to-one routing ────────────────────────────────────────

export interface RoutingOptions {
  /** Primary target — always attempted */
  primary: CrmDeliveryTarget;
  /** Fallback — attempted only if primary fails */
  fallback?: CrmDeliveryTarget;
  vendorName: string;
  dealershipEmail?: string;
  dealershipName?: string;
}

export interface RoutingResult {
  primaryResult: DeliveryResult;
  fallbackResult?: DeliveryResult;
  delivered: boolean;
}

export async function routeLeadToCrm(
  lead: AdfLeadData,
  opts: RoutingOptions
): Promise<RoutingResult> {
  const xml = buildAdfXml(lead, opts.vendorName);
  const jsonPayload = JSON.stringify({ lead, source: opts.vendorName });
  const fromName = opts.dealershipName ?? opts.vendorName;
  const fromEmail = opts.dealershipEmail ?? "leads@autocdp.com";

  async function deliver(target: CrmDeliveryTarget): Promise<DeliveryResult> {
    if (target.type === "email") {
      const fmt = target.format ?? "adf";
      const body = fmt === "json" ? jsonPayload : xml;
      return deliverViaEmail(body, target, fromName, fromEmail);
    }
    const fmt = target.format ?? "adf";
    if (fmt === "json") {
      return deliverViaHttp(jsonPayload, "application/json", target);
    }
    return deliverViaHttp(xml, "application/xml", target);
  }

  const primaryResult = await deliver(opts.primary);
  if (primaryResult.success || !opts.fallback) {
    return { primaryResult, delivered: primaryResult.success };
  }

  const fallbackResult = await deliver(opts.fallback);
  return { primaryResult, fallbackResult, delivered: fallbackResult.success };
}

// ── Conquest lead → ADF adapter ───────────────────────────────

export function conquestLeadToAdf(lead: ConquestLead): AdfLeadData {
  return {
    firstName: lead.first_name,
    lastName: lead.last_name,
    email: lead.email,
    phone: lead.phone,
    address: lead.address as AdfLeadData["address"],
    vehicleInterest: lead.vehicle_interest,
    comments: lead.notes,
    source: lead.source,
    externalId: lead.id,
  };
}
