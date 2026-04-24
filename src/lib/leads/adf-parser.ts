/**
 * ADF (Auto-lead Data Format) 1.0 parser.
 *
 * Handles inbound XML from DealerFunnel, Xcel Media, and any ADF-compliant provider.
 * Uses regex extraction — no external XML dependency required in the Edge runtime.
 */

export interface ParsedLead {
  source: string;
  externalId: string | null;
  requestDate: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  phoneType: "voice" | "cellular" | "fax" | null;
  address: {
    street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  vehicle: {
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    vin: string | null;
    condition: string | null; // "new" | "used" | "cpo"
    interest: string | null;  // "buy" | "lease" | "finance"
  };
  comments: string | null;
  rawPayload: string;
}

// ── Low-level helpers ─────────────────────────────────────────

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`, "i"));
  return m ? (m[1].trim() || null) : null;
}

function attr(xml: string, name: string, attrName: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*\\s${attrName}=["']([^"']+)["']`, "i"));
  return m ? m[1].trim() : null;
}

function block(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[0] : null;
}

function namePart(xml: string, part: "first" | "last"): string | null {
  // <name part="first">John</name>  OR  <name part='first'>John</name>
  const m = xml.match(new RegExp(`<name[^>]*part=["']${part}["'][^>]*>([^<]*)</name>`, "i"));
  return m ? (m[1].trim() || null) : null;
}

function phone(xml: string): { number: string | null; type: "voice" | "cellular" | "fax" | null } {
  const m = xml.match(/<phone[^>]*type=["']([^"']+)["'][^>]*>([^<]*)<\/phone>/i);
  if (m) {
    const t = m[1].toLowerCase();
    return {
      type: (t === "voice" || t === "cellular" || t === "fax") ? t : "voice",
      number: m[2].trim() || null,
    };
  }
  const simple = xml.match(/<phone[^>]*>([^<]*)<\/phone>/i);
  return { type: "voice", number: simple ? (simple[1].trim() || null) : null };
}

// ── ADF XML parser ────────────────────────────────────────────

export function parseAdf(raw: string): ParsedLead {
  const xml = raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\r\n/g, "\n");

  const prospectBlock  = block(xml, "prospect") ?? xml;
  const customerBlock  = block(prospectBlock, "customer") ?? prospectBlock;
  const contactBlock   = block(customerBlock, "contact") ?? customerBlock;
  const vehicleBlock   = block(prospectBlock, "vehicle") ?? "";
  const vendorBlock    = block(prospectBlock, "vendor") ?? "";
  const addrBlock      = block(contactBlock, "address") ?? contactBlock;

  const ph = phone(contactBlock);

  // External ID: prefer <id> inside prospect, fallback to sequence attr
  const idEl = prospectBlock.match(/<id[^>]*sequence=["'](\d+)["'][^>]*>([^<]*)<\/id>/i);
  const externalId = idEl ? (idEl[2].trim() || idEl[1]) : tag(prospectBlock, "id");

  return {
    source:      tag(vendorBlock, "vendorname") ?? tag(xml, "source") ?? "adf_webhook",
    externalId,
    requestDate: tag(prospectBlock, "requestdate"),
    firstName:   namePart(contactBlock, "first") ?? tag(contactBlock, "firstname"),
    lastName:    namePart(contactBlock, "last")  ?? tag(contactBlock, "lastname"),
    email:       tag(contactBlock, "email"),
    phone:       ph.number,
    phoneType:   ph.type,
    address: {
      street: tag(addrBlock, "street") ?? tag(addrBlock, "address1"),
      city:   tag(addrBlock, "city"),
      state:  tag(addrBlock, "state") ?? tag(addrBlock, "province"),
      zip:    tag(addrBlock, "postalcode") ?? tag(addrBlock, "zip"),
    },
    vehicle: {
      year:      (() => { const y = tag(vehicleBlock, "year"); return y ? parseInt(y, 10) || null : null; })(),
      make:      tag(vehicleBlock, "make"),
      model:     tag(vehicleBlock, "model"),
      trim:      tag(vehicleBlock, "trim"),
      vin:       tag(vehicleBlock, "vin"),
      condition: attr(vehicleBlock, "vehicle", "status") ?? tag(vehicleBlock, "condition"),
      interest:  attr(vehicleBlock, "vehicle", "interest"),
    },
    comments:   tag(customerBlock, "comments"),
    rawPayload: raw,
  };
}

// ── JSON lead parser (Xcel Media and newer providers) ─────────

export function parseJsonLead(body: Record<string, unknown>, source: string): ParsedLead {
  const c = (body.contact ?? body.customer ?? body) as Record<string, unknown>;
  const v = (body.vehicle ?? body.vehicle_interest ?? {}) as Record<string, unknown>;
  const a = (c.address ?? body.address ?? {}) as Record<string, unknown>;
  const str = (x: unknown) => (x != null ? String(x).trim() || null : null);
  const num = (x: unknown) => (x != null ? parseInt(String(x), 10) || null : null);

  return {
    source:      String(body.source ?? body.vendor ?? source),
    externalId:  str(body.id ?? body.lead_id ?? body.external_id),
    requestDate: str(body.requestdate ?? body.created_at ?? body.timestamp),
    firstName:   str(c.first_name ?? c.firstName ?? body.first_name),
    lastName:    str(c.last_name  ?? c.lastName  ?? body.last_name),
    email:       str(c.email ?? body.email),
    phone:       str(c.phone ?? c.mobile ?? body.phone),
    phoneType:   "voice",
    address: {
      street: str(a.street ?? a.address1),
      city:   str(a.city),
      state:  str(a.state),
      zip:    str(a.zip ?? a.postal_code),
    },
    vehicle: {
      year:      num(v.year),
      make:      str(v.make),
      model:     str(v.model),
      trim:      str(v.trim),
      vin:       str(v.vin),
      condition: str(v.condition ?? v.status),
      interest:  str(v.interest ?? v.intent),
    },
    comments:   str(body.comments ?? body.notes ?? body.message),
    rawPayload: JSON.stringify(body),
  };
}

// ── Format detection ──────────────────────────────────────────

export function detectBodyFormat(body: string): "adf" | "json" | "unknown" {
  const t = body.trimStart();
  if (t.startsWith("<") || t.startsWith("<?")) return "adf";
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  return "unknown";
}
