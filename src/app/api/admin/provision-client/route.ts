import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    dealershipName: string;
    gmName?: string;
    phone?: string;
    website?: string;
    city?: string;
    state?: string;
    clientEmail: string;
    clientPassword: string;
  };

  const { dealershipName, gmName, phone, website, city, state, clientEmail, clientPassword } = body;

  if (!dealershipName?.trim() || !clientEmail?.trim() || !clientPassword?.trim()) {
    return NextResponse.json({ error: "dealershipName, clientEmail, and clientPassword are required" }, { status: 400 });
  }

  const svc = createServiceClient();

  // ── Build unique slug ──────────────────────────────────────────
  let slug = dealershipName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { data: existingSlug } = await svc.from("dealerships").select("id").eq("slug", slug).maybeSingle();
  if (existingSlug) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;

  // ── Create dealership ──────────────────────────────────────────
  const svcAny = svc as unknown as Record<string, (...args: unknown[]) => unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dealership, error: dealershipErr } = await (svc as any)
    .from("dealerships")
    .insert({
      name:        dealershipName.trim(),
      slug,
      phone:       phone?.trim()   || null,
      website_url: website?.trim() || null,
      address:     city || state ? { city: city?.trim(), state: state?.trim() } : {},
    })
    .select()
    .single() as { data: { id: string } | null; error: { message: string } | null };
  void svcAny; // suppress unused warning

  if (dealershipErr || !dealership) {
    return NextResponse.json({ error: `Dealership create failed: ${dealershipErr?.message}` }, { status: 500 });
  }

  // ── Create client Supabase Auth account ───────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: authData, error: authCreateErr } = await (svc.auth.admin as any).createUser({
    email:         clientEmail.trim().toLowerCase(),
    password:      clientPassword,
    email_confirm: true,
    user_metadata: { full_name: gmName?.trim() ?? "" },
  }) as { data: { user: { id: string } | null }; error: { message: string } | null };

  if (authCreateErr || !authData?.user) {
    await svc.from("dealerships").delete().eq("id", dealership.id);
    return NextResponse.json({ error: `User create failed: ${authCreateErr?.message}` }, { status: 500 });
  }

  // ── Link user as owner ─────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: linkErr } = await (svc as any).from("user_dealerships").insert({
    user_id:       authData.user.id,
    dealership_id: dealership.id,
    role:          "owner",
  }) as { error: { message: string } | null };

  if (linkErr) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.auth.admin as any).deleteUser(authData.user.id);
    await svc.from("dealerships").delete().eq("id", dealership.id);
    return NextResponse.json({ error: `Link failed: ${linkErr.message}` }, { status: 500 });
  }

  return NextResponse.json(
    { dealershipId: dealership.id, userId: authData.user.id, slug },
    { status: 201 },
  );
}
