import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single();

  if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const { data: vehicles } = await svc
    .from("inventory")
    .select("condition, status, price, days_on_lot, metadata")
    .eq("dealership_id", ud.dealership_id)
    .eq("status", "available");

  const list = vehicles ?? [];
  const totalVehicles = list.length;

  let totalDays = 0;
  let totalValue = 0;
  const agingBuckets = { "<30": 0, "30-60": 0, "60-90": 0, "90+": 0 };
  const conditionCount: Record<string, number> = {};
  let priceAbove = 0, priceAt = 0, priceBelow = 0;
  let ptmSum = 0, ptmCount = 0;
  let turnoverSum = 0, turnoverCount = 0;
  let demandSum = 0, demandCount = 0;

  for (const v of list) {
    const days = v.days_on_lot ?? 0;
    const price = Number(v.price ?? 0);
    const meta = v.metadata as Record<string, unknown> | null;

    totalDays += days;
    totalValue += price;

    if (days < 30)       agingBuckets["<30"]++;
    else if (days < 60)  agingBuckets["30-60"]++;
    else if (days < 90)  agingBuckets["60-90"]++;
    else                 agingBuckets["90+"]++;

    const cond = v.condition ?? "used";
    conditionCount[cond] = (conditionCount[cond] ?? 0) + 1;

    const ptm = meta?.price_to_market as number | null;
    if (ptm != null) {
      ptmSum += ptm;
      ptmCount++;
      if (ptm > 100)       priceAbove++;
      else if (ptm < 100)  priceBelow++;
      else                 priceAt++;
    }

    const td = meta?.turnover_days as number | null;
    if (td != null) { turnoverSum += td; turnoverCount++; }

    const di = meta?.demand_index as number | null;
    if (di != null) { demandSum += di; demandCount++; }
  }

  const agedCount = agingBuckets["60-90"] + agingBuckets["90+"];

  return NextResponse.json({
    totalVehicles,
    agedCount,
    avgDaysOnLot: totalVehicles > 0 ? Math.round(totalDays / totalVehicles) : 0,
    totalInventoryValue: Math.round(totalValue),
    agingBuckets,
    conditionBreakdown: conditionCount,
    priceToMarket: ptmCount > 0 ? { above: priceAbove, atMarket: priceAt, below: priceBelow } : null,
    avgPriceToMarket: ptmCount > 0 ? Math.round(ptmSum / ptmCount * 10) / 10 : null,
    avgTurnoverDays: turnoverCount > 0 ? Math.round(turnoverSum / turnoverCount) : null,
    avgDemandIndex: demandCount > 0 ? Math.round(demandSum / demandCount) : null,
  });
}
