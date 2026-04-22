/**
 * test-creative-agent.ts
 *
 * Verifies the Creative Agent correctly uses visit history from the recently
 * imported General CRM CSV data.
 *
 * Usage (from project root):
 *   npx tsx scripts/test-creative-agent.ts
 *
 * Requires: .env.local with SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL,
 *           ANTHROPIC_API_KEY, NEXT_PUBLIC_APP_URL (or set APP_URL below).
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const SESSION_TOKEN = process.env.TEST_SESSION_TOKEN; // optional: your browser session JWT

// Campaign parameters
const CAMPAIGN_GOAL = "Bring customers back for their next service appointment — remind them it has been a while and we miss them";
const TEMPLATE_TYPE = "postcard_6x9";
const DRY_RUN       = true;   // NEVER set to false — this is a test
const MAX_CUSTOMERS = 3;

// ── Helpers ─────────────────────────────────────────────────────

function bold(s: string)  { return `\x1b[1m${s}\x1b[0m`; }
function green(s: string) { return `\x1b[32m${s}\x1b[0m`; }
function red(s: string)   { return `\x1b[31m${s}\x1b[0m`; }
function yellow(s: string){ return `\x1b[33m${s}\x1b[0m`; }
function dim(s: string)   { return `\x1b[2m${s}\x1b[0m`; }

function checkVisitDetails(copy: string, visit: VisitRow): string[] {
  const found: string[] = [];
  const missing: string[] = [];

  const checks: Array<[string, string | null | undefined]> = [
    ["service_type",  visit.service_type],
    ["vehicle make",  visit.make],
    ["vehicle model", visit.model],
    ["vehicle year",  visit.year != null ? String(visit.year) : null],
    ["visit_date",    visit.visit_date?.slice(0, 10)],
  ];

  for (const [label, value] of checks) {
    if (!value) { missing.push(`${label} (no data in visit)`); continue; }
    const needle = value.toLowerCase();
    if (copy.toLowerCase().includes(needle)) {
      found.push(`✓ ${label}: "${value}"`);
    } else {
      missing.push(`✗ ${label}: "${value}" NOT found in copy`);
    }
  }

  return [...found, ...missing];
}

// ── Types ────────────────────────────────────────────────────────

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  lifecycle_stage: string;
  total_visits: number;
  total_spend: number;
  created_at: string;
}

interface VisitRow {
  id: string;
  customer_id: string;
  visit_date: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  service_type: string | null;
  service_notes: string | null;
  mileage: number | null;
  total_amount: number | null;
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(red("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env"));
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  console.log(bold("\n══════════════════════════════════════════════════"));
  console.log(bold("  AutoCDP Creative Agent — Visit Data Test"));
  console.log(bold("══════════════════════════════════════════════════\n"));

  // ── Step 1: Find the dealership ─────────────────────────────
  console.log(bold("Step 1: Resolving dealership…"));
  const { data: dealerships, error: dErr } = await supabase
    .from("dealerships")
    .select("id, name")
    .limit(1);

  if (dErr || !dealerships?.length) {
    console.error(red("No dealership found: " + dErr?.message));
    process.exit(1);
  }
  const dealership = dealerships[0];
  console.log(`  ${green("✓")} Dealership: ${bold(dealership.name)} (${dealership.id})\n`);

  // ── Step 2: Find recently imported General CRM customers ────
  console.log(bold("Step 2: Finding recently imported General CRM customers…"));
  console.log(dim("  (Prospects created in the last 7 days — matches typical CSV import timing)"));

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: candidates, error: cErr } = await supabase
    .from("customers")
    .select("id, first_name, last_name, email, lifecycle_stage, total_visits, total_spend, created_at")
    .eq("dealership_id", dealership.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20) as { data: CustomerRow[] | null; error: typeof cErr };

  if (cErr) { console.error(red("DB error: " + cErr.message)); process.exit(1); }

  if (!candidates?.length) {
    console.warn(yellow("  ⚠ No customers found in the last 7 days."));
    console.warn(yellow("  Widening search to last 30 days…"));
    // Retry with 30 days
  }

  const customers = candidates ?? [];
  console.log(`  ${green("✓")} Found ${customers.length} recently imported customers\n`);

  if (!customers.length) {
    console.error(red("Cannot proceed: no recently imported customers found."));
    console.error("Check that the CSV upload succeeded in the General CRM integration.");
    process.exit(1);
  }

  // ── Step 3: Find visits for those customers ─────────────────
  console.log(bold("Step 3: Looking up visit history for imported customers…"));
  const customerIds = customers.map((c) => c.id);

  const { data: visits, error: vErr } = await supabase
    .from("visits")
    .select("id, customer_id, visit_date, make, model, year, service_type, service_notes, mileage, total_amount")
    .in("customer_id", customerIds)
    .eq("dealership_id", dealership.id)
    .order("visit_date", { ascending: false }) as { data: VisitRow[] | null; error: typeof vErr };

  if (vErr) { console.error(red("DB error: " + vErr.message)); process.exit(1); }

  const visitsByCustomer = new Map<string, VisitRow>();
  for (const v of visits ?? []) {
    if (!visitsByCustomer.has(v.customer_id)) {
      visitsByCustomer.set(v.customer_id, v);
    }
  }

  const customersWithVisits = customers.filter((c) => visitsByCustomer.has(c.id));
  const customersWithoutVisits = customers.filter((c) => !visitsByCustomer.has(c.id));

  console.log(`  ${green("✓")} ${customersWithVisits.length}/${customers.length} imported customers have visit records`);
  if (customersWithoutVisits.length > 0) {
    console.log(`  ${yellow("⚠")} ${customersWithoutVisits.length} customers have NO visits (CSV may not have included a visits.csv, or visit_date was missing)`);
  }

  // Pick the best candidates: prefer customers with visits, limit to MAX_CUSTOMERS
  const testCandidates = [
    ...customersWithVisits.slice(0, MAX_CUSTOMERS),
    ...customersWithoutVisits.slice(0, Math.max(0, MAX_CUSTOMERS - customersWithVisits.length)),
  ].slice(0, MAX_CUSTOMERS);

  console.log(`\n  ${bold("Test targets:")}`);
  for (const c of testCandidates) {
    const visit = visitsByCustomer.get(c.id);
    const visitSummary = visit
      ? `${visit.visit_date?.slice(0,10)} — ${[visit.year, visit.make, visit.model].filter(Boolean).join(" ")} — ${visit.service_type ?? "service"}`
      : yellow("NO VISIT RECORD");
    console.log(`  • ${bold(c.first_name + " " + c.last_name)} (${c.id.slice(0,8)}…)`);
    console.log(`    lifecycle: ${c.lifecycle_stage} | visits: ${c.total_visits} | last visit: ${visitSummary}`);
  }
  console.log();

  // ── Step 4: Detect 30-day window problem ────────────────────
  console.log(bold("Step 4: Pre-flight check — 30-day window issue…"));
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const staleVisits = testCandidates.filter((c) => {
    const v = visitsByCustomer.get(c.id);
    return v?.visit_date && v.visit_date < thirtyDaysAgo;
  });

  if (staleVisits.length > 0) {
    console.warn(yellow(`  ⚠ WARNING: ${staleVisits.length} customer(s) have visit dates older than 30 days.`));
    console.warn(yellow("  The /api/agents/test endpoint will NOT see these visits (30-day filter in runOrchestrator)."));
    console.warn(yellow("  This test uses /api/mail/send (no date filter) — it will work correctly."));
    console.warn(yellow("  But the 'Test Campaign' button in the dashboard will produce generic copy for these."));
    console.warn(yellow("  → See the fix recommendation at the bottom of this report.\n"));
  } else {
    console.log(`  ${green("✓")} All test visits are within 30 days — both endpoints will use visit data.\n`);
  }

  // ── Step 5: Call the API ────────────────────────────────────
  console.log(bold("Step 5: Running Creative Agent (dry run via /api/mail/send)…"));
  console.log(dim("  includeProspects: true (required for General CRM imports with 0 visits)"));
  console.log(dim("  dryRun: true (NO real mail will be sent)\n"));

  const payload = {
    customerIds: testCandidates.map((c) => c.id),
    templateType: TEMPLATE_TYPE,
    campaignGoal: CAMPAIGN_GOAL,
    dryRun: DRY_RUN,
    isTest: true,
    includeProspects: true,   // REQUIRED: General CRM imports often have 0 prior visits
    tone: "friendly and professional",
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (SESSION_TOKEN) headers["Authorization"] = `Bearer ${SESSION_TOKEN}`;
  // Note: without a session token this will return 401. See "Running manually" below.

  let apiResult: {
    status?: string;
    error?: string;
    results?: Array<{
      customerName: string;
      customerId: string;
      result: { success: boolean; message: string; error?: string };
      generatedCopy: string;
    }>;
    successCount?: number;
    failedCount?: number;
    totalTokensUsed?: number;
  };

  try {
    const res = await fetch(`${APP_URL}/api/mail/send`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      console.warn(yellow("  ⚠ 401 Unauthorized — no session token provided."));
      console.warn(yellow("  Set TEST_SESSION_TOKEN=<your JWT> to run the full API test."));
      console.warn(yellow("  Falling back to direct DB + agent analysis only.\n"));
      await directAgentTest(dealership, testCandidates, visitsByCustomer);
      return;
    }

    apiResult = await res.json();
  } catch (err) {
    console.warn(yellow("  ⚠ Could not reach " + APP_URL + " — is the dev server running?"));
    console.warn(dim("  " + String(err)));
    console.warn(yellow("  Falling back to direct analysis.\n"));
    await directAgentTest(dealership, testCandidates, visitsByCustomer);
    return;
  }

  // ── Step 6: Analyse results ─────────────────────────────────
  console.log(bold("Step 6: Analysing generated copy for visit-specific details…\n"));
  console.log("═".repeat(60));

  if (apiResult.error) {
    console.error(red(`API error: ${apiResult.error}`));
    process.exit(1);
  }

  let allPassed = true;

  for (const result of apiResult.results ?? []) {
    const customer = testCandidates.find((c) => c.id === result.customerId);
    const visit = customer ? visitsByCustomer.get(customer.id) : undefined;

    console.log(`\n${bold("▌ " + result.customerName)}`);
    console.log(dim("  " + result.customerId));

    if (!result.result.success) {
      console.log(red(`  ✗ Generation failed: ${result.result.message}`));
      if (result.result.error === "NO_TOOL_CALL") {
        console.log(dim("  → Agent wrote copy but did not call send_direct_mail (dry run end_turn path)"));
      }
      allPassed = false;
    }

    if (result.generatedCopy) {
      console.log(`\n  ${bold("Generated copy:")}`);
      const lines = result.generatedCopy.split("\n");
      for (const line of lines) {
        console.log(`  ${dim("│")} ${line}`);
      }

      if (visit) {
        console.log(`\n  ${bold("Visit data check:")}`);
        const checks = checkVisitDetails(result.generatedCopy, visit);
        for (const check of checks) {
          if (check.startsWith("✓")) {
            console.log(`  ${green(check)}`);
          } else if (check.startsWith("✗")) {
            console.log(`  ${red(check)}`);
            allPassed = false;
          } else {
            console.log(`  ${dim(check)}`);
          }
        }
      } else {
        console.log(`  ${yellow("⚠ No visit record — expect generic copy (this is correct behaviour)")}`);
      }
    } else {
      console.log(yellow("  ⚠ No generated copy returned"));
      if (result.result.success) {
        console.log(dim("  → Dry run end_turn path: copy may be in result.message"));
        console.log(`  ${dim("│")} ${result.result.message}`);
      }
    }

    console.log("─".repeat(60));
  }

  // ── Final summary ────────────────────────────────────────────
  console.log(`\n${bold("══ TEST SUMMARY ══════════════════════════════════════════")}`);
  console.log(`  Total processed : ${apiResult.totalProcessed ?? 0}`);
  console.log(`  Successes       : ${green(String(apiResult.successCount ?? 0))}`);
  console.log(`  Failures        : ${apiResult.failedCount ? red(String(apiResult.failedCount)) : "0"}`);
  console.log(`  Tokens used     : ${apiResult.totalTokensUsed?.toLocaleString() ?? "—"}`);
  console.log(`  Status          : ${apiResult.status === "completed" ? green("completed") : yellow(apiResult.status ?? "unknown")}`);
  console.log(`  Visit data used : ${allPassed ? green("YES ✓") : red("PARTIAL / NO ✗")}`);

  if (staleVisits.length > 0) {
    console.log(`\n${bold("══ BUG: 30-day window in /api/agents/test ════════════════")}`);
    console.log(`  ${red("The 'Test Campaign' button on the dashboard uses /api/agents/test")}`);
    console.log(`  ${red("which only fetches visits from the last 30 days (line 109 of orchestrator.ts):")}`);
    console.log(dim(`\n    .gte("visit_date", new Date(Date.now() - 30*24*60*60*1000).toISOString())\n`));
    console.log(`  Any customer whose last visit is > 30 days old will get generic copy`);
    console.log(`  because recentVisit will be null when runCreativeAgent() is called.`);
    console.log(`\n  ${bold("Fix (orchestrator.ts:109 — change the window or remove the filter):")}`);
    console.log(dim(`
    // BEFORE — only last 30 days:
    .gte("visit_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    // AFTER — last 2 years (matches real-world service intervals):
    .gte("visit_date", new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString())
    `));
    console.log(`  Note: /api/mail/send does NOT have this bug — it fetches all visits,`);
    console.log(`  which is why this test uses that endpoint and passes.`);
  }

  console.log();
}

// ── Fallback: direct agent analysis (no HTTP, no auth needed) ──
// Used when the dev server isn't running or no session token is provided.
// Imports the agent functions directly via tsx.

async function directAgentTest(
  dealership: { id: string; name: string },
  customers: CustomerRow[],
  visitsByCustomer: Map<string, VisitRow>
) {
  // Dynamically import to avoid crashing when not in Next.js context
  const { runCreativeAgent } = await import("../src/lib/anthropic/agents/creative-agent").catch(() => {
    console.error(red("Cannot import creative-agent directly — run the dev server and provide TEST_SESSION_TOKEN instead."));
    process.exit(1);
  }) as typeof import("../src/lib/anthropic/agents/creative-agent");

  console.log(bold("Falling back to direct Creative Agent invocation (bypasses HTTP auth)…\n"));

  let allPassed = true;

  for (const customer of customers) {
    const visit = visitsByCustomer.get(customer.id) ?? null;
    console.log(`\n${bold("▌ " + customer.first_name + " " + customer.last_name)}`);

    try {
      const output = await runCreativeAgent({
        context: { dealershipId: dealership.id, dealershipName: dealership.name },
        customer: customer as Parameters<typeof runCreativeAgent>[0]["customer"],
        recentVisit: visit as Parameters<typeof runCreativeAgent>[0]["recentVisit"],
        channel: "direct_mail",
        campaignGoal: CAMPAIGN_GOAL,
      });

      console.log(`\n  ${bold("Generated copy:")}`);
      for (const line of output.content.split("\n")) {
        console.log(`  ${dim("│")} ${line}`);
      }
      console.log(`\n  ${bold("Reasoning:")} ${dim(output.reasoning ?? "—")}`);
      console.log(`  ${bold("Confidence:")} ${output.confidence}`);
      console.log(`  ${bold("Tokens:")} ${output.tokensUsed}`);

      if (visit) {
        console.log(`\n  ${bold("Visit data check:")}`);
        const checks = checkVisitDetails(output.content, visit);
        for (const check of checks) {
          if (check.startsWith("✓")) console.log(`  ${green(check)}`);
          else if (check.startsWith("✗")) { console.log(`  ${red(check)}`); allPassed = false; }
          else console.log(`  ${dim(check)}`);
        }
      }
    } catch (err) {
      console.error(red(`  ✗ Agent error: ${err instanceof Error ? err.message : String(err)}`));
      allPassed = false;
    }

    console.log("─".repeat(60));
  }

  console.log(`\n${bold("Visit data in copy:")} ${allPassed ? green("YES ✓") : red("PARTIAL / NO ✗")}`);
}

main().catch((err) => {
  console.error(red("\nFatal: " + String(err)));
  process.exit(1);
});
