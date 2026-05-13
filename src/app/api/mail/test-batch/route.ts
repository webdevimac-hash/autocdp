import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runDirectMailOrchestrator } from "@/lib/anthropic/agents/orchestrator";
import { toApiError } from "@/lib/errors";
import { getActiveDealershipId } from "@/lib/dealership";
import type { Customer, MailTemplateType, DesignStyle } from "@/types";

/**
 * POST /api/mail/test-batch
 *
 * Sends 5–10 real PostGrid test pieces using a representative sample of the
 * selected audience. Pieces are tagged isTest=true (no charge with test key).
 * Cadence filter is bypassed — test batches always go through.
 *
 * Sampling strategy: picks one customer per lifecycle stage (VIP, lapsed,
 * active, at-risk, prospect) in priority order, preferring those with a valid
 * mailing address. Fills remaining slots from the general pool.
 *
 * Body:
 *   customerIds  string[]
 *   templateType MailTemplateType
 *   campaignGoal string
 *   designStyle? DesignStyle
 *   batchSize?   number (1–10, default 5)
 */

const STAGE_PRIORITY: Array<Customer["lifecycle_stage"]> = [
  "vip", "lapsed", "active", "at_risk", "prospect",
];

function pickRepresentativeSample(customers: Customer[], n: number): Customer[] {
  const byStage = new Map<Customer["lifecycle_stage"], Customer[]>();
  for (const c of customers) {
    const arr = byStage.get(c.lifecycle_stage) ?? [];
    arr.push(c);
    byStage.set(c.lifecycle_stage, arr);
  }

  const picked: Customer[] = [];

  // One representative per stage, prefer those with a valid address
  for (const stage of STAGE_PRIORITY) {
    if (picked.length >= n) break;
    const pool = byStage.get(stage) ?? [];
    const addressable = pool.filter((c) => c.address?.street);
    const source = addressable.length > 0 ? addressable : pool;
    if (source.length > 0) {
      picked.push(source[Math.floor(Math.random() * source.length)]);
    }
  }

  // Fill remaining slots from any addressable customer not yet picked
  if (picked.length < n) {
    const pickedIds = new Set(picked.map((c) => c.id));
    const remaining = customers
      .filter((c) => !pickedIds.has(c.id) && c.address?.street)
      .slice(0, n - picked.length);
    picked.push(...remaining);
  }

  return picked.slice(0, n);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) {
      return NextResponse.json({ error: "No dealership found" }, { status: 400 });
    }

    const body = await req.json();
    const {
      customerIds,
      templateType,
      campaignGoal,
      designStyle = "standard",
      batchSize = 5,
    }: {
      customerIds: string[];
      templateType: MailTemplateType;
      campaignGoal: string;
      designStyle?: DesignStyle;
      batchSize?: number;
    } = body;

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ error: "customerIds is required" }, { status: 400 });
    }
    if (!["postcard_6x9", "letter_6x9", "letter_8.5x11"].includes(templateType)) {
      return NextResponse.json({ error: "Invalid templateType" }, { status: 400 });
    }
    if (!campaignGoal?.trim()) {
      return NextResponse.json({ error: "campaignGoal is required" }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
    }
    if (!process.env.POSTGRID_API_KEY) {
      return NextResponse.json({ error: "POSTGRID_API_KEY not configured" }, { status: 503 });
    }

    const clampedSize = Math.min(10, Math.max(1, batchSize));

    const [{ data: customers }, { data: dealership }] = await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .in("id", customerIds)
        .eq("dealership_id", dealershipId),
      supabase
        .from("dealerships")
        .select("name")
        .eq("id", dealershipId)
        .single() as unknown as Promise<{ data: { name: string } | null }>,
    ]);

    if (!customers?.length) {
      return NextResponse.json({ error: "No valid customers found" }, { status: 404 });
    }

    const sample = pickRepresentativeSample(customers as Customer[], clampedSize);
    if (sample.length === 0) {
      return NextResponse.json(
        { error: "No customers with mailing addresses found in the selected audience" },
        { status: 400 }
      );
    }

    const result = await runDirectMailOrchestrator({
      context: {
        dealershipId,
        dealershipName: dealership?.name ?? "Your Dealership",
      },
      campaignGoal,
      templateType,
      customerIds: sample.map((c) => c.id),
      dryRun: false,
      isTest: true,
      designStyle,
      applyCadenceFilter: false, // test batches always bypass cadence
    });

    return NextResponse.json({
      batchSize: sample.length,
      sampled: sample.map((c) => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`,
        lifecycle_stage: c.lifecycle_stage,
      })),
      ...result,
    });
  } catch (error) {
    const { error: msg, code, statusCode } = toApiError(error);
    return NextResponse.json({ error: msg, code }, { status: statusCode });
  }
}
