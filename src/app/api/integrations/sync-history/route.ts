import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: dealership } = await svc
    .from("dealerships")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!dealership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: jobs } = await svc
    .from("sync_jobs")
    .select("id, provider, job_type, status, started_at, completed_at, records_synced, error")
    .eq("dealership_id", dealership.id)
    .order("started_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ jobs: jobs ?? [] });
}
