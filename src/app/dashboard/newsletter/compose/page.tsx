import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { NewsletterComposer } from "./compose-client";
import type { Newsletter } from "@/lib/newsletter/types";

export const metadata = { title: "Write Newsletter" };

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = createServiceClient();
  const { data: ud } = await svc.from("user_dealerships").select("dealership_id").eq("user_id", user.id).single();
  if (!ud?.dealership_id) redirect("/onboarding");

  const { data: dealership } = await svc
    .from("dealerships")
    .select("name, website_url, settings")
    .eq("id", ud.dealership_id)
    .single();
  const dealerName = (dealership as { name: string } | null)?.name ?? "My Dealership";
  const xtimeUrl   = ((dealership as { settings?: Record<string, unknown> | null } | null)?.settings?.xtime_url as string | null) ?? null;

  // Count eligible recipients
  const { count: recipientCount } = await svc
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("dealership_id", ud.dealership_id)
    .not("email", "is", null)
    .not("email", "eq", "") as unknown as { count: number | null };

  // Load existing draft if ?id= is provided
  const { id: draftId } = await searchParams;
  let draft: Newsletter | null = null;

  if (draftId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc as any)
      .from("newsletters")
      .select("*")
      .eq("id", draftId)
      .eq("dealership_id", ud.dealership_id)
      .single() as { data: Newsletter | null };
    if (data?.status === "draft") draft = data;
  }

  return (
    <>
      <Header
        title={draft ? "Edit Newsletter" : "Write Newsletter"}
        subtitle={`${dealerName} · ${recipientCount ?? 0} recipients`}
        userEmail={user.email}
      />
      <NewsletterComposer
        dealerName={dealerName}
        xtimeUrl={xtimeUrl ?? undefined}
        recipientCount={recipientCount ?? 0}
        draft={draft}
      />
    </>
  );
}
