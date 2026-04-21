import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) {
      return NextResponse.json({ error: "No dealership found" }, { status: 400 });
    }

    // Load campaign + mail pieces
    const [campaignRes, piecesRes] = await Promise.all([
      (supabase
        .from("campaigns" as any)
        .select("*")
        .eq("id", campaignId)
        .eq("dealership_id", dealershipId)
        .single() as any),
      (supabase
        .from("mail_pieces" as any)
        .select("*, customers(first_name, last_name, email, phone, city, state)")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true }) as any),
    ]);

    if (campaignRes.error || !campaignRes.data) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const campaign = campaignRes.data as any;
    const pieces = (piecesRes.data ?? []) as any[];

    // Build CSV rows
    const headers = [
      "Piece ID",
      "Customer Name",
      "Email",
      "Phone",
      "City",
      "State",
      "Status",
      "Template Type",
      "Subject",
      "Personalized Copy (first 200 chars)",
      "PostGrid ID",
      "Sent At",
      "Scanned At",
      "Dry Run",
    ];

    const rows = pieces.map((p: any) => {
      const customer = p.customers ?? {};
      const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "—";
      const copy = (p.body ?? p.content ?? "").replace(/"/g, '""').substring(0, 200);
      const subject = (p.subject ?? "").replace(/"/g, '""');
      return [
        p.id ?? "",
        name,
        customer.email ?? "",
        customer.phone ?? "",
        customer.city ?? "",
        customer.state ?? "",
        p.status ?? "",
        p.template_type ?? "",
        `"${subject}"`,
        `"${copy}"`,
        p.postgrid_letter_id ?? p.postgrid_id ?? "",
        p.sent_at ?? p.created_at ?? "",
        p.scanned_at ?? "",
        p.dry_run ? "Yes" : "No",
      ];
    });

    // Summary stats
    const totalSent = pieces.filter((p: any) => p.status === "sent" || p.status === "mailed").length;
    const totalScanned = pieces.filter((p: any) => p.scanned_at).length;
    const scanRate = totalSent > 0 ? ((totalScanned / totalSent) * 100).toFixed(1) : "0.0";
    const estimatedRoi = totalScanned > 0
      ? `~$${(totalScanned * 2800 * 0.04).toLocaleString("en-US", { maximumFractionDigits: 0 })} (est.)`
      : "Insufficient data";

    const summaryRows = [
      ["=== CAMPAIGN REPORT ==="],
      [`Campaign Name:,${(campaign.name ?? campaignId).replace(/,/g, " ")}`],
      [`Campaign Goal:,"${(campaign.goal ?? "").replace(/"/g, "''")}"`],
      [`Template Type:,${campaign.template_type ?? ""}`],
      [`Total Recipients:,${pieces.length}`],
      [`Pieces Sent:,${totalSent}`],
      [`Pieces Scanned:,${totalScanned}`],
      [`Scan Rate:,${scanRate}%`],
      [`Estimated ROI:,${estimatedRoi}`],
      [`Report Generated:,${new Date().toISOString()}`],
      [],
      ["=== INDIVIDUAL PIECES ==="],
      [headers.join(",")],
      ...rows.map((r) => r.join(",")),
    ];

    const csv = summaryRows.map((r) => (Array.isArray(r) ? r.join(",") : r)).join("\r\n");

    const safeName = (campaign.name ?? campaignId).replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="campaign_${safeName}_report.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[campaign-report]", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
