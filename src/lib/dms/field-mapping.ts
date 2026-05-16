/**
 * Field Mapping & Transformation Layer
 *
 * Centralises all bidirectional translation between AutoCDP's canonical data
 * model and the three supported CRMs: VinSolutions, Dealertrack, and Elead.
 *
 * Exports:
 *   - CanonicalCustomer / CanonicalActivity — internal representation
 *   - normalizePhone / normalizeEmail / normalizeName / normalizeDate
 *   - mapVinContact / mapVinLead / mapVinActivity
 *   - mapDtContact  / mapDtLead  / mapDtActivity
 *   - mapEleadContact / mapEleadLead / mapEleadActivity
 *   - vinStatusFromLifecycle / dtStatusFromLifecycle / eleadStatusFromLifecycle
 *   - vinActivityType / dtActivityType / eleadActivityType
 *   - webhookUpdateFromVin / webhookUpdateFromDt / webhookUpdateFromElead
 *   - canonicalToDbRow
 */

import type {
  VinContact,
  VinLead,
  VinActivity,
} from "./vinsolutions";
import type {
  DealertrackContact,
  DealertrackLead,
  DealertrackActivity,
} from "./dealertrack";
import type {
  EleadContact,
  EleadLead,
  EleadActivity,
} from "./elead";

// ---------------------------------------------------------------------------
// Canonical types
// ---------------------------------------------------------------------------

export type LifecycleStage =
  | "prospect"
  | "active"
  | "sold"
  | "service_customer"
  | "inactive";

export interface CanonicalAddress {
  street: string | null;
  city:   string | null;
  state:  string | null;
  zip:    string | null;
}

export interface CanonicalVehicleInterest {
  year?:  number;
  make?:  string;
  model?: string;
  vin?:   string;
}

export interface CanonicalCustomer {
  /** AutoCDP `dms_external_id` format: "<provider>:<nativeId>" */
  dmsExternalId:    string;
  firstName:        string;
  lastName:         string;
  email:            string | null;
  phone:            string | null;
  address:          CanonicalAddress | null;
  lifecycleStage:   LifecycleStage;
  leadSource:       string | null;
  leadStatus:       string | null;
  vehicleInterest:  CanonicalVehicleInterest | null;
  optedOut:         boolean;
  /** Arbitrary provider-specific extras stored in metadata */
  extra:            Record<string, unknown>;
}

export interface CanonicalActivity {
  dmsExternalId: string;
  /** AutoCDP customer UUID (resolved from customerIdMap) */
  customerId:    string;
  visitDate:     string;
  activityType:  string;
  subject:       string | null;
  notes:         string | null;
  extra:         Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Data normalizers
// ---------------------------------------------------------------------------

/** Strips non-digit chars; returns formatted (XXX) XXX-XXXX or E.164 fallback */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return raw.trim() || null;
}

/** Lowercases and trims; returns null if empty */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase().trim();
  return v || null;
}

/** Title-cases a name segment */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Coerces any date string to ISO 8601 (YYYY-MM-DD) or returns null */
export function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lifecycle stage ↔ CRM lead status maps
// ---------------------------------------------------------------------------

// VinSolutions lead statuses: new | working | contacted | appointment | sold | lost | inactive
const VIN_STATUS_TO_LIFECYCLE: Record<string, LifecycleStage> = {
  new:         "prospect",
  working:     "prospect",
  contacted:   "prospect",
  appointment: "active",
  active:      "active",
  sold:        "sold",
  closed:      "sold",
  lost:        "inactive",
  inactive:    "inactive",
  dead:        "inactive",
  service:     "service_customer",
};

const LIFECYCLE_TO_VIN_STATUS: Record<LifecycleStage, string> = {
  prospect:         "working",
  active:           "appointment",
  sold:             "sold",
  service_customer: "sold",   // VinSolutions has no distinct service status
  inactive:         "inactive",
};

// Dealertrack lead statuses: new | open | working | contacted | appointment | sold | closed_lost | inactive
const DT_STATUS_TO_LIFECYCLE: Record<string, LifecycleStage> = {
  new:         "prospect",
  open:        "prospect",
  working:     "prospect",
  contacted:   "prospect",
  appointment: "active",
  active:      "active",
  sold:        "sold",
  closed:      "sold",
  closed_lost: "inactive",
  lost:        "inactive",
  inactive:    "inactive",
  dead:        "inactive",
};

const LIFECYCLE_TO_DT_STATUS: Record<LifecycleStage, string> = {
  prospect:         "working",
  active:           "appointment",
  sold:             "sold",
  service_customer: "sold",
  inactive:         "closed_lost",
};

// Elead lead statuses: new | in_progress | contacted | appointment | sold | lost | dead
const ELEAD_STATUS_TO_LIFECYCLE: Record<string, LifecycleStage> = {
  new:         "prospect",
  in_progress: "prospect",
  contacted:   "prospect",
  appointment: "active",
  active:      "active",
  sold:        "sold",
  closed:      "sold",
  lost:        "inactive",
  dead:        "inactive",
  inactive:    "inactive",
};

const LIFECYCLE_TO_ELEAD_STATUS: Record<LifecycleStage, string> = {
  prospect:         "in_progress",
  active:           "appointment",
  sold:             "sold",
  service_customer: "sold",
  inactive:         "lost",
};

/** Maps a raw CRM lead status string → AutoCDP lifecycle_stage */
export function lifecycleFromVinStatus(status: string | undefined): LifecycleStage {
  return VIN_STATUS_TO_LIFECYCLE[status?.toLowerCase() ?? ""] ?? "prospect";
}
export function lifecycleFromDtStatus(status: string | undefined): LifecycleStage {
  return DT_STATUS_TO_LIFECYCLE[status?.toLowerCase() ?? ""] ?? "prospect";
}
export function lifecycleFromEleadStatus(status: string | undefined): LifecycleStage {
  return ELEAD_STATUS_TO_LIFECYCLE[status?.toLowerCase() ?? ""] ?? "prospect";
}

/** Maps AutoCDP lifecycle_stage → CRM-native lead status string (for push) */
export function vinStatusFromLifecycle(stage: LifecycleStage): string {
  return LIFECYCLE_TO_VIN_STATUS[stage];
}
export function dtStatusFromLifecycle(stage: LifecycleStage): string {
  return LIFECYCLE_TO_DT_STATUS[stage];
}
export function eleadStatusFromLifecycle(stage: LifecycleStage): string {
  return LIFECYCLE_TO_ELEAD_STATUS[stage];
}

// ---------------------------------------------------------------------------
// Activity type maps (AutoCDP write-back event → CRM-native type string)
// ---------------------------------------------------------------------------

export type WritebackEvent =
  | "campaign_sent"
  | "qr_scanned"
  | "email_opened"
  | "link_clicked"
  | "booking_made";

// VinSolutions accepts: phone_call | email | appointment | note | task | other
const WRITEBACK_TO_VIN_TYPE: Record<WritebackEvent, string> = {
  campaign_sent: "note",
  qr_scanned:   "task",
  email_opened: "email",
  link_clicked: "task",
  booking_made: "appointment",
};

// Dealertrack accepts: Phone Call | Email | Appointment | Note | Task
const WRITEBACK_TO_DT_TYPE: Record<WritebackEvent, string> = {
  campaign_sent: "Note",
  qr_scanned:   "Task",
  email_opened: "Email",
  link_clicked: "Task",
  booking_made: "Appointment",
};

// Elead accepts: Call | Email | Appointment | Note | Other
const WRITEBACK_TO_ELEAD_TYPE: Record<WritebackEvent, string> = {
  campaign_sent: "Note",
  qr_scanned:   "Other",
  email_opened: "Email",
  link_clicked: "Other",
  booking_made: "Appointment",
};

export function vinActivityType(event: WritebackEvent): string {
  return WRITEBACK_TO_VIN_TYPE[event] ?? "note";
}
export function dtActivityType(event: WritebackEvent): string {
  return WRITEBACK_TO_DT_TYPE[event] ?? "Note";
}
export function eleadActivityType(event: WritebackEvent): string {
  return WRITEBACK_TO_ELEAD_TYPE[event] ?? "Note";
}

// Pulled CRM activity type → AutoCDP service_type label
const VIN_PULLED_TYPE_MAP: Record<string, string> = {
  phone_call:  "crm_call",
  email:       "email_engagement",
  appointment: "crm_appointment",
  note:        "crm_note",
  task:        "crm_task",
};
const DT_PULLED_TYPE_MAP: Record<string, string> = {
  "Phone Call":  "crm_call",
  "Email":       "email_engagement",
  "Appointment": "crm_appointment",
  "Note":        "crm_note",
  "Task":        "crm_task",
};
const ELEAD_PULLED_TYPE_MAP: Record<string, string> = {
  Call:        "crm_call",
  Email:       "email_engagement",
  Appointment: "crm_appointment",
  Note:        "crm_note",
  Other:       "crm_activity",
};

// ---------------------------------------------------------------------------
// dms_external_id helper
// ---------------------------------------------------------------------------

function dmsId(provider: string, nativeId: string): string {
  return `${provider}:${nativeId}`;
}

// ---------------------------------------------------------------------------
// VinSolutions pull mappers
// ---------------------------------------------------------------------------

export function mapVinContact(
  c: VinContact,
  dealershipId: string
): Record<string, unknown> {
  return {
    dealership_id:   dealershipId,
    dms_external_id: dmsId("vinsolutions", c.contactId),
    first_name:      normalizeName(c.firstName),
    last_name:       normalizeName(c.lastName),
    email:           normalizeEmail(c.email),
    phone:           normalizePhone(c.phone),
    address: c.address
      ? {
          street: c.address.street ?? null,
          city:   c.address.city   ?? null,
          state:  c.address.state  ?? null,
          zip:    c.address.zip    ?? null,
        }
      : null,
    metadata: {
      dms_source: { provider: "vinsolutions", id: c.contactId },
    },
  };
}

export function mapVinLead(
  l: VinLead,
  dealershipId: string
): Record<string, unknown> {
  return {
    dealership_id:   dealershipId,
    dms_external_id: dmsId("vinsolutions", `lead:${l.leadId}`),
    first_name:      normalizeName(l.firstName),
    last_name:       normalizeName(l.lastName),
    email:           normalizeEmail(l.email),
    phone:           normalizePhone(l.phone),
    address:         null,
    lifecycle_stage: lifecycleFromVinStatus(l.leadStatus),
    metadata: {
      dms_source:       { provider: "vinsolutions", id: l.leadId },
      lead_source:      l.leadSource      ?? null,
      lead_status:      l.leadStatus      ?? null,
      vehicle_interest: l.vehicleInterest
        ? {
            year:  l.vehicleInterest.year  ?? null,
            make:  l.vehicleInterest.make  ?? null,
            model: l.vehicleInterest.model ?? null,
            vin:   l.vehicleInterest.vin   ?? null,
          }
        : null,
    },
  };
}

export function mapVinActivity(
  a: VinActivity,
  customerId: string,
  dealershipId: string
): Record<string, unknown> {
  const serviceType =
    VIN_PULLED_TYPE_MAP[a.activityType?.toLowerCase() ?? ""] ?? "crm_activity";
  const notes = [
    a.subject ? `${a.activityType}: ${a.subject}` : null,
    a.notes,
  ]
    .filter(Boolean)
    .join(" — ") || null;

  return {
    dealership_id:   dealershipId,
    dms_external_id: dmsId("vinsolutions", `act:${a.activityId}`),
    customer_id:     customerId,
    visit_date:      a.activityDate,
    service_type:    serviceType,
    service_notes:   notes,
    metadata: {
      dms_source:    { provider: "vinsolutions", id: a.activityId },
      activity_type: a.activityType,
    },
  };
}

// ---------------------------------------------------------------------------
// Dealertrack pull mappers
// ---------------------------------------------------------------------------

export function mapDtContact(
  c: DealertrackContact,
  dealershipId: string
): Record<string, unknown> {
  return {
    dealership_id:   dealershipId,
    dms_external_id: dmsId("dealertrack", c.contactId),
    first_name:      normalizeName(c.firstName),
    last_name:       normalizeName(c.lastName),
    email:           normalizeEmail(c.email),
    phone:           normalizePhone(c.phone),
    address: c.address
      ? {
          street: c.address.street ?? null,
          city:   c.address.city   ?? null,
          state:  c.address.state  ?? null,
          zip:    c.address.zip    ?? null,
        }
      : null,
    metadata: {
      dms_source: { provider: "dealertrack", id: c.contactId },
    },
  };
}

export function mapDtLead(
  l: DealertrackLead,
  dealershipId: string
): Record<string, unknown> {
  return {
    dealership_id:   dealershipId,
    dms_external_id: dmsId("dealertrack", l.leadId),
    first_name:      normalizeName(l.firstName),
    last_name:       normalizeName(l.lastName),
    email:           normalizeEmail(l.email),
    phone:           normalizePhone(l.phone),
    address: l.address
      ? {
          street: l.address.street ?? null,
          city:   l.address.city   ?? null,
          state:  l.address.state  ?? null,
          zip:    l.address.zip    ?? null,
        }
      : null,
    lifecycle_stage: lifecycleFromDtStatus(l.leadStatus),
    metadata: {
      dms_source:       { provider: "dealertrack", id: l.leadId },
      lead_source:      l.leadSource      ?? null,
      lead_status:      l.leadStatus      ?? null,
      vehicle_interest: l.vehicleInterest
        ? {
            year:  l.vehicleInterest.year  ?? null,
            make:  l.vehicleInterest.make  ?? null,
            model: l.vehicleInterest.model ?? null,
            vin:   l.vehicleInterest.vin   ?? null,
          }
        : null,
    },
  };
}

export function mapDtActivity(
  a: DealertrackActivity,
  customerId: string,
  dealershipId: string
): Record<string, unknown> {
  const serviceType =
    DT_PULLED_TYPE_MAP[a.activityType ?? ""] ?? "crm_activity";
  const notes = [a.subject, a.notes].filter(Boolean).join(" — ") || null;

  return {
    dealership_id:   dealershipId,
    dms_external_id: dmsId("dealertrack", `act:${a.activityId}`),
    customer_id:     customerId,
    visit_date:      a.activityDate,
    service_type:    serviceType,
    service_notes:   notes,
    metadata: {
      dms_source:    { provider: "dealertrack", id: a.activityId },
      activity_type: a.activityType,
    },
  };
}

// ---------------------------------------------------------------------------
// Elead pull mappers
// ---------------------------------------------------------------------------

export function mapEleadContact(
  c: EleadContact,
  dealershipId: string
): Record<string, unknown> {
  return {
    dealership_id:   dealershipId,
    dms_external_id: dmsId("elead", c.contactId),
    first_name:      normalizeName(c.firstName),
    last_name:       normalizeName(c.lastName),
    email:           normalizeEmail(c.email),
    phone:           normalizePhone(c.phone),
    address: c.address
      ? {
          street: c.address.street ?? null,
          city:   c.address.city   ?? null,
          state:  c.address.state  ?? null,
          zip:    c.address.zip    ?? null,
        }
      : null,
    metadata: {
      dms_source: { provider: "elead", id: c.contactId },
    },
  };
}

export function mapEleadLead(
  l: EleadLead,
  dealershipId: string
): Record<string, unknown> {
  return {
    dealership_id:   dealershipId,
    dms_external_id: dmsId("elead", l.leadId),
    first_name:      normalizeName(l.firstName),
    last_name:       normalizeName(l.lastName),
    email:           normalizeEmail(l.email),
    phone:           normalizePhone(l.phone),
    address: l.address
      ? {
          street: l.address.street ?? null,
          city:   l.address.city   ?? null,
          state:  l.address.state  ?? null,
          zip:    l.address.zip    ?? null,
        }
      : null,
    lifecycle_stage: lifecycleFromEleadStatus(l.leadStatus),
    metadata: {
      dms_source:       { provider: "elead", id: l.leadId },
      lead_source:      l.leadSource      ?? null,
      lead_status:      l.leadStatus      ?? null,
      vehicle_interest: l.vehicleInterest
        ? {
            year:  l.vehicleInterest.year  ?? null,
            make:  l.vehicleInterest.make  ?? null,
            model: l.vehicleInterest.model ?? null,
            vin:   l.vehicleInterest.vin   ?? null,
          }
        : null,
    },
  };
}

export function mapEleadActivity(
  a: EleadActivity,
  customerId: string,
  dealershipId: string
): Record<string, unknown> {
  const serviceType =
    ELEAD_PULLED_TYPE_MAP[a.activityType ?? ""] ?? "crm_activity";
  const notes = [a.subject, a.notes].filter(Boolean).join(" — ") || null;

  return {
    dealership_id:   dealershipId,
    dms_external_id: dmsId("elead", `act:${a.activityId}`),
    customer_id:     customerId,
    visit_date:      a.activityDate,
    service_type:    serviceType,
    service_notes:   notes,
    metadata: {
      dms_source:    { provider: "elead", id: a.activityId },
      activity_type: a.activityType,
    },
  };
}

// ---------------------------------------------------------------------------
// Webhook update builders
// Returns a partial customers-table row ready for Supabase update
// ---------------------------------------------------------------------------

interface WebhookContactPayload {
  firstName?: string;
  lastName?:  string;
  email?:     string;
  phone?:     string;
  address?:   { street?: string; city?: string; state?: string; zip?: string };
  leadStatus?: string;
  optOut?:    boolean;
  dnc?:       boolean;
}

export function webhookUpdateFromVin(
  payload: WebhookContactPayload,
  existingTags: string[] = []
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (payload.firstName) patch.first_name = normalizeName(payload.firstName);
  if (payload.lastName)  patch.last_name  = normalizeName(payload.lastName);
  if (payload.email)     patch.email      = normalizeEmail(payload.email);
  if (payload.phone)     patch.phone      = normalizePhone(payload.phone);
  if (payload.address) {
    patch.address = {
      street: payload.address.street ?? null,
      city:   payload.address.city   ?? null,
      state:  payload.address.state  ?? null,
      zip:    payload.address.zip    ?? null,
    };
  }
  if (payload.leadStatus) {
    patch.lifecycle_stage = lifecycleFromVinStatus(payload.leadStatus);
  }
  if (payload.optOut) {
    const tags = [...new Set([...existingTags, "tcpa_optout"])];
    patch.tags = tags;
  }
  return patch;
}

export function webhookUpdateFromDt(
  payload: WebhookContactPayload,
  existingTags: string[] = []
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (payload.firstName) patch.first_name = normalizeName(payload.firstName);
  if (payload.lastName)  patch.last_name  = normalizeName(payload.lastName);
  if (payload.email)     patch.email      = normalizeEmail(payload.email);
  if (payload.phone)     patch.phone      = normalizePhone(payload.phone);
  if (payload.address) {
    patch.address = {
      street: payload.address.street ?? null,
      city:   payload.address.city   ?? null,
      state:  payload.address.state  ?? null,
      zip:    payload.address.zip    ?? null,
    };
  }
  if (payload.leadStatus) {
    patch.lifecycle_stage = lifecycleFromDtStatus(payload.leadStatus);
  }
  if (payload.optOut) {
    const tags = [...new Set([...existingTags, "tcpa_optout"])];
    patch.tags = tags;
  }
  return patch;
}

export function webhookUpdateFromElead(
  payload: WebhookContactPayload,
  existingTags: string[] = []
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (payload.firstName) patch.first_name = normalizeName(payload.firstName);
  if (payload.lastName)  patch.last_name  = normalizeName(payload.lastName);
  if (payload.email)     patch.email      = normalizeEmail(payload.email);
  if (payload.phone)     patch.phone      = normalizePhone(payload.phone);
  if (payload.address) {
    patch.address = {
      street: payload.address.street ?? null,
      city:   payload.address.city   ?? null,
      state:  payload.address.state  ?? null,
      zip:    payload.address.zip    ?? null,
    };
  }
  if (payload.leadStatus) {
    patch.lifecycle_stage = lifecycleFromEleadStatus(payload.leadStatus);
  }
  if (payload.dnc || payload.optOut) {
    const tags = [...new Set([...existingTags, "tcpa_optout"])];
    patch.tags = tags;
  }
  return patch;
}

// ---------------------------------------------------------------------------
// canonicalToDbRow — convert a CanonicalCustomer to a Supabase insert/upsert row
// ---------------------------------------------------------------------------

export function canonicalToDbRow(
  c: CanonicalCustomer,
  dealershipId: string
): Record<string, unknown> {
  return {
    dealership_id:   dealershipId,
    dms_external_id: c.dmsExternalId,
    first_name:      c.firstName,
    last_name:       c.lastName,
    email:           c.email,
    phone:           c.phone,
    address:         c.address,
    lifecycle_stage: c.lifecycleStage,
    tags:            c.optedOut ? ["tcpa_optout"] : [],
    metadata: {
      lead_source:      c.leadSource,
      lead_status:      c.leadStatus,
      vehicle_interest: c.vehicleInterest,
      ...c.extra,
    },
  };
}
