import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { EmailBlastTable } from "@/components/email-blast/email-blast-table";
import type { EmailBlastRow } from "@/components/email-blast/email-blast-table";

export const metadata = { title: "Email Blast" };

export default async function EmailBlastPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user!.id)
    .single();

  // TODO: Replace stub with real Supabase query.
  // Suggested: query campaigns where channel = 'email', join communications for stats.
  // Map to EmailBlastRow. Wire email_score to a Sonnet 4.6 grader on the campaign row.
  const rows: EmailBlastRow[] = [];

  return (
    <>
      <Header title="Email Blast" userEmail={user?.email} />
      <main className="flex-1">
        <EmailBlastTable rows={rows} />
      </main>
    </>
  );
}
