import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { TemplatesClient } from "@/components/templates/templates-client";

export const metadata = { title: "Message Templates" };

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) redirect("/onboarding");

  const svc = createServiceClient();
  const { data: templates } = await (svc
    .from("campaign_templates")
    .select("*")
    .eq("dealership_id", dealershipId)
    .eq("is_active", true)
    .order("is_ai_suggested", { ascending: false })
    .order("times_used", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100)) as unknown as { data: Record<string, unknown>[] | null };

  return (
    <>
      <Header
        title="Message Templates"
        subtitle="AI-generated and saved templates for direct mail, SMS, and email"
        userEmail={user?.email}
      />
      <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto">
        <TemplatesClient initialTemplates={(templates ?? []) as unknown as Parameters<typeof TemplatesClient>[0]["initialTemplates"]} />
      </main>
    </>
  );
}
