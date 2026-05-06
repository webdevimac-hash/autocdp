/**
 * RFC 4180-compliant CSV parser.
 *
 * Handles:
 *  - Quoted fields with embedded commas
 *  - Quoted fields with embedded newlines (multi-line, e.g. DriveCentric "Customer" column)
 *  - Escaped double-quotes ("")
 *
 * Safe to import from both client components ("use client") and server API routes
 * because it has no server-only dependencies.
 */

// ---------------------------------------------------------------------------
// Core parser
// ---------------------------------------------------------------------------

/** Parse a CSV string into raw field arrays — one array per logical record. */
export function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  let fields: string[] = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQ) {
      if (ch === '"' && src[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQ = true;
      } else if (ch === ",") {
        fields.push(cur);
        cur = "";
      } else if (ch === "\n") {
        fields.push(cur);
        if (fields.some((f) => f !== "")) records.push(fields);
        fields = [];
        cur = "";
      } else {
        cur += ch;
      }
    }
  }

  // Flush the final field / record
  fields.push(cur);
  if (fields.some((f) => f !== "")) records.push(fields);

  return records;
}

/**
 * Parse a CSV string into header-keyed row objects.
 * The first record becomes the header row; all values are trimmed.
 */
export function parseCsvToRows(text: string): Record<string, string>[] {
  const records = parseCsvRecords(text);
  if (records.length < 2) return [];

  const headers = records[0].map((h) => h.trim());
  return records.slice(1).map((fields) => {
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (fields[idx] ?? "").trim();
    });
    return row;
  });
}

// ---------------------------------------------------------------------------
// DriveCentric field helpers
// ---------------------------------------------------------------------------

/** Pattern that matches DriveCentric initials-only lines like "ML" or "JA". */
const DC_INITIALS_RE = /^[A-Z]{1,4}$/;

/**
 * Parse DriveCentric's combined "Customer" column value into first/last name.
 *
 * DriveCentric exports names as a multi-line quoted field:
 *   "ML\n\nMiyah Lowe"  →  firstName: "Miyah", lastName: "Lowe"
 *
 * Also handles plain "Miyah Lowe" for non-DC sources.
 */
export function parseDriveCentricName(raw: string): { firstName: string; lastName: string } {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !DC_INITIALS_RE.test(l));

  const nameLine = lines[lines.length - 1] ?? "";
  const parts = nameLine.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  return {
    firstName: parts[0],
    lastName:  parts.slice(1).join(" "),
  };
}

/** Makes that consist of more than one word — must be matched before splitting on first space. */
const MULTI_WORD_MAKES = [
  "Mercedes-Benz",
  "Land Rover",
  "Alfa Romeo",
  "Aston Martin",
  "Rolls-Royce",
  "Ram Pickup",
];

/**
 * Parse DriveCentric's combined "Vehicle" column value into year / make / model.
 *
 * Examples:
 *   "2023 BMW XM"              →  { year: 2023, make: "BMW",           model: "XM" }
 *   "2026 Mercedes-Benz AMG GT" → { year: 2026, make: "Mercedes-Benz", model: "AMG GT" }
 *   "2027 MINI Countryman"     →  { year: 2027, make: "MINI",          model: "Countryman" }
 */
export function parseDriveCentricVehicle(raw: string): {
  year:  number | null;
  make:  string;
  model: string;
} {
  const trimmed = raw.trim();
  const match   = trimmed.match(/^(\d{4})\s+(.+)$/);
  if (!match) return { year: null, make: "", model: trimmed };

  const year = parseInt(match[1], 10);
  const rest = match[2].trim();

  for (const make of MULTI_WORD_MAKES) {
    if (rest.toLowerCase().startsWith(make.toLowerCase() + " ")) {
      return { year, make, model: rest.slice(make.length + 1).trim() };
    }
  }

  const space = rest.indexOf(" ");
  return space === -1
    ? { year, make: rest, model: "" }
    : { year, make: rest.slice(0, space), model: rest.slice(space + 1) };
}

/**
 * Sentinel strings DriveCentric uses to mean "no data".
 * A col() helper that understands these can treat them as empty.
 */
export const DC_NULL_VALUES = new Set([
  "unknown",
  "-",
  "n/a",
  "1 not available",
  "fumbled",
]);
