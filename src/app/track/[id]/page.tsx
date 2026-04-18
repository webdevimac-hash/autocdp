import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { Car, Phone, MapPin, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runOptimizationAgent } from "@/lib/anthropic/agents/optimization-agent";
import type { Metadata } from "next";

export const dynamic = "force-dynamic"; // always fresh for accurate scan tracking

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (id === "preview") return { title: "Preview | AutoCDP" };

  const supabase = createServiceClient();
  const { data: mp } = await supabase
    .from("mail_pieces")
    .select("dealerships(name)")
    .eq("id", id)
    .single();

  const dealershipName = (mp?.dealerships as { name?: string })?.name ?? "Your Dealership";
  return {
    title: `Special Offer from ${dealershipName}`,
    description: `You received a personalized message from ${dealershipName}. Scan to see your exclusive offer.`,
  };
}

export default async function TrackPage({ params }: Props) {
  const { id } = await params;

  // Preview mode — shown during QR preview in campaign builder
  if (id === "preview") {
    return <TrackingPageUI dealershipName="Your Dealership" isPreview />;
  }

  const supabase = createServiceClient();

  // Load the mail piece + customer + dealership
  const { data: mailPiece } = await supabase
    .from("mail_pieces")
    .select(`
      id,
      template_type,
      variables,
      scanned_count,
      dealership_id,
      customers (
        first_name,
        last_name,
        lifecycle_stage
      ),
      dealerships (
        name,
        phone,
        address,
        website_url,
        hours
      )
    `)
    .eq("id", id)
    .single();

  if (!mailPiece) notFound();

  // Log this scan asynchronously (don't block page render)
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headersList.get("user-agent") ?? null;
  const referrer = headersList.get("referer") ?? null;

  // Insert scan record — using service client so no auth needed
  await supabase.from("mail_scans").insert({
    mail_piece_id: id,
    dealership_id: mailPiece.dealership_id,
    ip_address: ip,
    user_agent: userAgent,
    referrer: referrer,
  });

  // Trigger learning update on the first scan of a piece — most valuable signal.
  // Fire-and-forget: does not block page render. Optimization agent skips gracefully
  // if there isn't enough data yet (< 2 sent pieces).
  if (mailPiece.scanned_count === 0) {
    const dealershipName =
      (mailPiece.dealerships as { name?: string } | null)?.name ?? "Dealership";
    void runOptimizationAgent({
      context: {
        dealershipId: mailPiece.dealership_id,
        dealershipName,
      },
      mailPieceIds: [id],
    }).catch((err) =>
      console.warn("[track] scan-triggered optimization failed:", err)
    );
  }

  const customer = mailPiece.customers as { first_name: string; last_name: string; lifecycle_stage: string } | null;
  const dealership = mailPiece.dealerships as {
    name: string;
    phone: string | null;
    address: { street?: string; city?: string; state?: string; zip?: string } | null;
    website_url: string | null;
    hours: Record<string, string> | null;
  } | null;

  const variables = (mailPiece.variables ?? {}) as Record<string, string>;

  return (
    <TrackingPageUI
      dealershipName={dealership?.name ?? "Your Dealership"}
      customerFirstName={customer?.first_name}
      phone={dealership?.phone}
      address={dealership?.address}
      websiteUrl={dealership?.website_url}
      offer={variables.offer}
      vehicle={variables.vehicle}
      scanCount={mailPiece.scanned_count}
      isPreview={false}
    />
  );
}

// ── UI Component ──────────────────────────────────────────────

interface TrackingPageUIProps {
  dealershipName: string;
  customerFirstName?: string;
  phone?: string | null;
  address?: { street?: string; city?: string; state?: string; zip?: string } | null;
  websiteUrl?: string | null;
  offer?: string | null;
  vehicle?: string | null;
  scanCount?: number;
  isPreview?: boolean;
}

function TrackingPageUI({
  dealershipName,
  customerFirstName,
  phone,
  address,
  websiteUrl,
  offer,
  vehicle,
  scanCount,
  isPreview = false,
}: TrackingPageUIProps) {
  const greeting = customerFirstName
    ? `Hi ${customerFirstName}!`
    : "You've got a special offer!";

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-900 to-brand-700 flex flex-col items-center justify-center p-4">
      {isPreview && (
        <div className="w-full max-w-sm mb-4">
          <div className="bg-amber-400 text-amber-900 text-xs font-semibold text-center py-2 px-4 rounded-full">
            Preview Mode — This is how customers see the landing page
          </div>
        </div>
      )}

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-700 to-brand-600 px-6 py-8 text-center">
          <div className="flex items-center justify-center w-14 h-14 bg-white/15 rounded-full mx-auto mb-3">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-white font-bold text-xl">{dealershipName}</h1>
          {address?.city && (
            <p className="text-blue-200 text-sm mt-0.5">
              {address.city}, {address.state}
            </p>
          )}
        </div>

        {/* Greeting */}
        <div className="px-6 py-6 text-center border-b">
          <div className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">
            <CheckCircle className="w-3.5 h-3.5" />
            You received a personal message from us
          </div>
          <h2 className="text-xl font-bold text-gray-900">{greeting}</h2>
          {vehicle && (
            <p className="text-sm text-muted-foreground mt-1">
              Regarding your <strong>{vehicle}</strong>
            </p>
          )}
        </div>

        {/* Offer highlight */}
        {offer && (
          <div className="mx-6 my-5 p-4 bg-brand-50 border border-brand-200 rounded-xl">
            <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-1">Your Exclusive Offer</p>
            <p className="text-brand-900 font-medium text-sm">{offer}</p>
          </div>
        )}

        {/* CTA */}
        <div className="px-6 pb-4 space-y-3">
          {phone && (
            <Button
              asChild
              className="w-full"
              size="lg"
            >
              <a href={`tel:${phone.replace(/\D/g, "")}`}>
                <Phone className="mr-2 h-4 w-4" />
                Call to Schedule: {phone}
              </a>
            </Button>
          )}

          {websiteUrl && (
            <Button variant="outline" asChild className="w-full">
              <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                Book Online
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
        </div>

        {/* Dealership info */}
        <div className="px-6 pb-6 space-y-2.5 border-t pt-4">
          {address?.street && (
            <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-brand-500" />
              <span>{address.street}, {address.city}, {address.state} {address.zip}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Phone className="w-4 h-4 shrink-0 text-brand-500" />
              <a href={`tel:${phone.replace(/\D/g, "")}`} className="hover:text-brand-700">{phone}</a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 text-center">
          <p className="text-[10px] text-muted-foreground">
            Powered by AutoCDP · {isPreview ? "Preview" : `Scanned ${(scanCount ?? 0) + 1} time${((scanCount ?? 0) + 1) !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>
    </div>
  );
}
