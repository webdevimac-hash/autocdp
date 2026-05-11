import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { LeadsList } from "@/components/customers/leads-list";
import type { LeadRow } from "@/components/customers/leads-list";
import type { CustomerDetailData } from "@/components/customers/customer-detail-panel";
import { formatRelativeDate } from "@/lib/utils";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id, dealerships(name)")
    .eq("user_id", user!.id)
    .single();

  const dealershipId = ud?.dealership_id ?? "";
  const storeName = (ud?.dealerships as any)?.name ?? "";

  const { data: customers, count } = await supabase
    .from("customers")
    .select("*", { count: "exact" })
    .eq("dealership_id", dealershipId)
    .order("last_visit_date", { ascending: false })
    .limit(100);

  // Map customers to the lightweight LeadRow shape.
  // TODO: Enrich with real source, last_attempt, response times, and assigned team
  // once you have those columns. The component contract won't change — just add
  // the fields to the returned objects.
  const rows: LeadRow[] = (customers ?? []).map((c) => ({
    id: c.id,
    first_name: c.first_name ?? "",
    last_name: c.last_name ?? "",
    store: storeName,
    created_label: formatRelativeDate(c.created_at ?? c.last_visit_date),
    source: (c.metadata as any)?.source,
    source_description: (c.metadata as any)?.source_description,
    last_attempt_label: c.last_visit_date
      ? formatRelativeDate(c.last_visit_date)
      : undefined,
    next_task: null,
  }));

  // Server action: loads full CustomerDetailData for a clicked row.
  // TODO: Enrich with visits, planned_tasks, past_activity, open_deal, garage
  // by joining the visits and communications tables.
  async function loadCustomerDetail(id: string): Promise<CustomerDetailData | null> {
    "use server";
    const srv = await createClient();
    const { data: c } = await srv
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();
    if (!c) return null;

    const { data: visits } = await srv
      .from("visits")
      .select("year, make, model, visit_date")
      .eq("customer_id", id)
      .order("visit_date", { ascending: false })
      .limit(10);

    const addr = c.address as any;
    const garage = visits
      ? Object.values(
          visits.reduce<Record<string, { year: number; make: string; model: string; owned_since?: string }>>(
            (acc, v) => {
              const key = `${v.make}-${v.model}`;
              if (!acc[key]) {
                acc[key] = {
                  year: v.year,
                  make: v.make,
                  model: v.model,
                  owned_since: v.visit_date ?? undefined,
                };
              }
              return acc;
            },
            {},
          ),
        ).slice(0, 5)
      : [];

    return {
      id: c.id,
      first_name: c.first_name ?? "",
      last_name: c.last_name ?? "",
      email: c.email ?? undefined,
      phones: c.phone ? [{ label: "Mobile", value: c.phone }] : [],
      address: addr
        ? {
            street: addr.street,
            city: addr.city,
            state: addr.state,
            zip: addr.zip,
          }
        : undefined,
      stage: c.lifecycle_stage?.replace("_", " ") ?? undefined,
      genius_summary: null,
      garage,
      planned_tasks: [],
      past_activity: [],
    };
  }

  return (
    <>
      <Header
        title="Customers"
        subtitle={`${count?.toLocaleString() ?? 0} total records`}
        userEmail={user?.email}
      />
      <main className="flex-1">
        <LeadsList
          rows={rows}
          totalCount={count ?? 0}
          loadDetail={loadCustomerDetail}
        />
      </main>
    </>
  );
}
