/**
 * POST /api/mail/batch-route
 *
 * Returns the recommended print vendor for a batch and estimated cost.
 * Does NOT submit the batch — call the send endpoints per vendor after routing.
 *
 * Body: { quantity, format, is_eddm?, is_premium?, is_first_class?, budget_cents_per_piece? }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { selectVendor, estimateBatchCost } from "@/lib/print/vendor-router";
import type { MailFormat } from "@/lib/print/vendor-router";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    quantity: number;
    format: MailFormat;
    is_eddm?: boolean;
    is_premium?: boolean;
    is_first_class?: boolean;
    budget_cents_per_piece?: number;
  };

  const { quantity, format } = body;
  if (!quantity || quantity < 1 || !format) {
    return NextResponse.json({ error: "quantity and format are required" }, { status: 400 });
  }

  const input = {
    quantity,
    format,
    isEddm: body.is_eddm ?? false,
    isPremiumQuality: body.is_premium ?? false,
    isFirstClass: body.is_first_class ?? false,
    budgetCentsPerPiece: body.budget_cents_per_piece,
  };

  const vendor = selectVendor(input);
  const cost = estimateBatchCost(input);

  return NextResponse.json({
    recommended_vendor: vendor.vendor,
    reason: vendor.reason,
    estimated_cost: {
      per_piece_cents: cost.perPieceCents,
      total_cents: cost.totalCents,
      turnaround_days: cost.turnaroundDays,
    },
    supports_test_mode: vendor.supportsTestMode,
  });
}
