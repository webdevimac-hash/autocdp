import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runDirectMailOrchestrator } from "@/lib/anthropic/agents/orchestrator";
import type { MailTemplateType } from "@/types";

/**
 * POST /api/mail/send
 *
 * Triggers the Direct Mail Orchestrator for a set of customers.
 * Claude calls send_direct_mail per customer in a tool-use loop.
 *
 * Body:
 *   customerIds    string[]          — customer UUIDs to send to
 *   templateType   MailTemplateType  — "postcard_6x9" | "letter_6x9" | "letter_8.5x11"
 *   campaignGoal   string            — goal description for Creative Agent
 *   campaignId?    string            — optional campaign UUID to associate mail pieces
 *   dryRun?        boolean           — if true: generate copy but skip PostGrid (default: false)
 *   tone?          string            — dealership tone override
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: ud } = await supabase
      .from("user_dealerships")
      .select("dealership_id")
      .eq("user_id", user.id)
      .single() as { data: { dealership_id: string } | null };

    if (!ud?.dealership_id) {
      return NextResponse.json({ error: "No dealership found" }, { status: 400 });
    }

    const { data: dealership } = await supabase
      .from("dealerships")
      .select("name")
      .eq("id", ud.dealership_id)
      .single() as { data: Record<string, string | null> | null };

    const body = await req.json();
    const {
      customerIds,
      templateType,
      campaignGoal,
      campaignId,
      dryRun = false,
      isTest = false,
      tone,
    } = body;

    // Validation
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ error: "customerIds must be a non-empty array" }, { status: 400 });
    }
    if (!["postcard_6x9", "letter_6x9", "letter_8.5x11"].includes(templateType)) {
      return NextResponse.json({ error: "Invalid templateType" }, { status: 400 });
    }
    if (!campaignGoal?.trim()) {
      return NextResponse.json({ error: "campaignGoal is required" }, { status: 400 });
    }
    if (customerIds.length > 50) {
      return NextResponse.json(
        { error: "Max 50 customers per API call. For larger batches, use bulk campaign." },
        { status: 400 }
      );
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 503 }
      );
    }
    if (!dryRun && !process.env.POSTGRID_API_KEY) {
      return NextResponse.json(
        { error: "POSTGRID_API_KEY is not configured. Set it in .env.local or use dryRun: true." },
        { status: 503 }
      );
    }

    const result = await runDirectMailOrchestrator({
      context: {
        dealershipId: ud.dealership_id,
        dealershipName: dealership?.name ?? "Your Dealership",
        campaignId,
      },
      campaignGoal,
      templateType: templateType as MailTemplateType,
      customerIds,
      dealershipTone: tone,
      dryRun,
      isTest,
      createdBy: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/mail/send]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
