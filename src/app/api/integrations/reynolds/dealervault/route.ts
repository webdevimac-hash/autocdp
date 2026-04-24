/**
 * POST /api/integrations/reynolds/dealervault
 *
 * Triggers a DealerVault sync for the current dealership.
 * Reads encrypted credentials from dms_connections, performs a full or
 * delta sync, and upserts customers, visits, and inventory.
 *
 * Body: { job_type?: "full" | "delta" }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  DealerVaultClient,
  dvCustomerToAutocdp,
  dvRoToAutocdp,
  dvVehicleToAutocdp,
} from "@/lib/integrations/reynolds-dealervault";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? "";

function decryptTokens(encrypted: string): Record<string, string> {
  // In production, use AES-256-GCM. This is a placeholder decode.
  // Replace with your actual decrypt implementation from lib/crypto.ts.
  try {
    return JSON.parse(Buffer.from(encrypted, "base64").toString("utf-8"));
  } catch {
    throw new Error("Failed to decrypt DealerVault tokens");
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { job_type?: "full" | "delta" };
  const jobType = body.job_type ?? "delta";

  const svc = createServiceClient();

  type UdRow = { dealership_id: string; role: string } | null;
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id, role")
    .eq("user_id", user.id)
    .single() as unknown as { data: UdRow };

  if (!ud || ud.role === "member") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Load DealerVault connection
  type ConnectionRow = {
    id: string; encrypted_tokens: string | null; last_sync_at: string | null;
    metadata: Record<string, unknown>;
  } | null;
  const { data: conn } = await svc
    .from("dms_connections")
    .select("id, encrypted_tokens, last_sync_at, metadata")
    .eq("dealership_id", ud.dealership_id)
    .eq("provider", "reynolds")
    .eq("status", "active")
    .single() as unknown as { data: ConnectionRow };

  if (!conn?.encrypted_tokens) {
    return NextResponse.json({ error: "No active Reynolds DealerVault connection found" }, { status: 404 });
  }

  let tokens: Record<string, string>;
  try {
    tokens = decryptTokens(conn.encrypted_tokens);
  } catch (err) {
    return NextResponse.json({ error: "Failed to decrypt credentials" }, { status: 500 });
  }

  const client = new DealerVaultClient({
    baseUrl: tokens.base_url ?? "https://api.dealervault.reyrey.com",
    clientId: tokens.client_id,
    clientSecret: tokens.client_secret,
    dealerCode: tokens.dealer_code,
  });

  const cursor = jobType === "delta" ? (conn.last_sync_at ?? undefined) : undefined;

  // Create sync job record
  type SyncJobRow = { id: string } | null;
  const { data: job } = await svc
    .from("sync_jobs")
    .insert({
      dealership_id: ud.dealership_id,
      connection_id: conn.id,
      provider: "reynolds",
      job_type: jobType,
      status: "running",
      started_at: new Date().toISOString(),
      records_synced: { customers: 0, visits: 0, inventory: 0 },
      error: null,
      cursor: cursor ?? null,
    } as never)
    .select("id")
    .single() as unknown as { data: SyncJobRow };

  const jobId = job?.id;

  try {
    const syncData = await client.fullSync(cursor);

    let customersSynced = 0;
    let visitsSynced = 0;

    // Upsert customers
    for (const dvCustomer of syncData.customers) {
      const customerData = dvCustomerToAutocdp(dvCustomer);
      const { data: existing } = await svc
        .from("customers")
        .select("id")
        .eq("dealership_id", ud.dealership_id)
        .eq("metadata->reynolds_customer_id", dvCustomer.customerId as never)
        .maybeSingle() as unknown as { data: { id: string } | null };

      if (existing) {
        await svc.from("customers").update(customerData as never).eq("id", existing.id);
      } else {
        const { data: newCustomer } = await svc
          .from("customers")
          .insert({
            dealership_id: ud.dealership_id,
            ...customerData,
            tags: [],
            lifecycle_stage: "prospect",
            total_visits: 0,
            total_spend: 0,
          } as never)
          .select("id")
          .single() as unknown as { data: { id: string } | null };

        if (newCustomer) customersSynced++;
      }
    }

    // Upsert repair orders as visits
    for (const ro of syncData.repairOrders) {
      // Find matching customer
      const { data: customer } = await svc
        .from("customers")
        .select("id")
        .eq("dealership_id", ud.dealership_id)
        .eq("metadata->reynolds_customer_id", ro.customerId as never)
        .maybeSingle() as unknown as { data: { id: string } | null };

      if (!customer) continue;

      const visitData = dvRoToAutocdp(ro);
      const { data: existingVisit } = await svc
        .from("visits")
        .select("id")
        .eq("dealership_id", ud.dealership_id)
        .eq("ro_number", ro.roNumber)
        .maybeSingle() as unknown as { data: { id: string } | null };

      if (!existingVisit) {
        await svc.from("visits").insert({
          dealership_id: ud.dealership_id,
          customer_id: customer.id,
          ...visitData,
        } as never);
        visitsSynced++;
      }
    }

    // Upsert inventory
    let inventorySynced = 0;
    for (const vehicle of syncData.inventory) {
      const vehicleData = dvVehicleToAutocdp(vehicle);
      const { data: existing } = await svc
        .from("inventory")
        .select("id")
        .eq("dealership_id", ud.dealership_id)
        .eq("vin", vehicle.vin)
        .maybeSingle() as unknown as { data: { id: string } | null };

      if (existing) {
        await svc.from("inventory").update(vehicleData as never).eq("id", existing.id);
      } else {
        await svc.from("inventory").insert({
          dealership_id: ud.dealership_id,
          ...vehicleData,
        } as never);
        inventorySynced++;
      }
    }

    // Update sync job and connection
    if (jobId) {
      await svc.from("sync_jobs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        records_synced: { customers: customersSynced, visits: visitsSynced, inventory: inventorySynced },
        cursor: syncData.cursor,
      } as never).eq("id", jobId);
    }

    await svc.from("dms_connections").update({
      last_sync_at: new Date().toISOString(),
      last_error: null,
    } as never).eq("id", conn.id);

    return NextResponse.json({
      success: true,
      job_id: jobId,
      records_synced: { customers: customersSynced, visits: visitsSynced, inventory: inventorySynced },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (jobId) {
      await svc.from("sync_jobs").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error: msg,
      } as never).eq("id", jobId);
    }
    await svc.from("dms_connections").update({ last_error: msg } as never).eq("id", conn.id);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
