import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneIncoming, PhoneOutgoing, Calendar, Clock, Mic } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";

export const metadata = { title: "Voice Agent" };

const OUTCOME_COLOR: Record<string, string> = {
  appointment_booked: "bg-green-100 text-green-700",
  callback_requested: "bg-blue-100 text-blue-700",
  not_interested: "bg-gray-100 text-gray-500",
  voicemail: "bg-amber-100 text-amber-700",
  no_answer: "bg-slate-100 text-slate-600",
  other: "bg-purple-100 text-purple-700",
};

export default async function VoicePage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single();

  const dealershipId = ud?.dealership_id ?? "";

  // Call logs — may not exist yet if migration 006 hasn't run
  const { data: callLogs } = await supabase
    .from("call_logs")
    .select("*, customers(first_name, last_name)")
    .eq("dealership_id", dealershipId)
    .order("created_at", { ascending: false })
    .limit(50)
    .maybeSingle()
    .then(() => supabase
      .from("call_logs")
      .select("*, customers(first_name, last_name)")
      .eq("dealership_id", dealershipId)
      .order("created_at", { ascending: false })
      .limit(50)
    ).catch(() => ({ data: null }));

  const calls = callLogs ?? [];
  const totalCalls = calls.length;
  const booked = calls.filter((c) => c.outcome === "appointment_booked").length;
  const outbound = calls.filter((c) => c.direction === "outbound").length;
  const avgDuration = totalCalls
    ? Math.round(calls.reduce((s, c) => s + (c.duration_seconds ?? 0), 0) / totalCalls)
    : 0;

  const stats = [
    { title: "Total Calls", value: totalCalls, icon: Phone, color: "text-blue-600 bg-blue-50" },
    { title: "Appointments Booked", value: booked, icon: Calendar, color: "text-green-600 bg-green-50" },
    { title: "Outbound Calls", value: outbound, icon: PhoneOutgoing, color: "text-purple-600 bg-purple-50" },
    { title: "Avg. Duration", value: `${avgDuration}s`, icon: Clock, color: "text-amber-600 bg-amber-50" },
  ];

  const isTwilioConfigured = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );

  return (
    <>
      <Header
        title="Voice Agent"
        subtitle="AI-assisted call logging and outcome tracking"
        userEmail={user.email}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.title} className="border-0 shadow-sm">
              <CardContent className="p-5 flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Status notice */}
        <Card className={`border-0 shadow-sm ${isTwilioConfigured ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Mic className={`w-5 h-5 mt-0.5 shrink-0 ${isTwilioConfigured ? "text-green-600" : "text-amber-600"}`} />
              <div>
                <p className={`text-sm font-semibold ${isTwilioConfigured ? "text-green-800" : "text-amber-800"}`}>
                  {isTwilioConfigured ? "Twilio connected" : "Twilio not configured"}
                </p>
                <p className={`text-xs mt-0.5 ${isTwilioConfigured ? "text-green-700" : "text-amber-700"}`}>
                  {isTwilioConfigured
                    ? `Outbound SMS is active. Voice calling (Twilio Programmable Voice) is the next integration milestone.`
                    : "Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to .env.local to enable SMS and voice."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Roadmap notice */}
        <Card className="border-0 shadow-sm bg-purple-50/40 border-purple-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-purple-800 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Voice Agent Roadmap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-purple-700">
              {[
                "Twilio Programmable Voice — outbound AI calls triggered by campaign swarm",
                "Real-time transcript via Deepgram or Twilio Speech Recognition",
                "Claude summarizes call outcome and updates customer lifecycle stage",
                "Appointment booked → triggers follow-up mail or SMS automatically",
                "Inbound call routing — AI triages service vs. sales vs. parts",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-200 text-purple-700 text-[9px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Call log table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Call Log</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {calls.length === 0 ? (
              <div className="py-16 text-center">
                <Phone className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No calls logged yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Call logs will appear here once the Voice Agent is active.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50/50">
                      {["Direction", "Customer", "Duration", "Outcome", "AI Summary", "Date"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {calls.map((call) => {
                      const customer = call.customers as { first_name: string; last_name: string } | null;
                      return (
                        <tr key={call.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3">
                            {call.direction === "inbound"
                              ? <span className="flex items-center gap-1 text-blue-600 text-xs"><PhoneIncoming className="w-3.5 h-3.5" />Inbound</span>
                              : <span className="flex items-center gap-1 text-purple-600 text-xs"><PhoneOutgoing className="w-3.5 h-3.5" />Outbound</span>
                            }
                          </td>
                          <td className="px-5 py-3 font-medium">
                            {customer ? `${customer.first_name} ${customer.last_name}` : call.from_number ?? "—"}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {call.duration_seconds ? `${call.duration_seconds}s` : "—"}
                          </td>
                          <td className="px-5 py-3">
                            {call.outcome ? (
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${OUTCOME_COLOR[call.outcome] ?? ""}`}>
                                {call.outcome.replace(/_/g, " ")}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground text-xs max-w-[200px] truncate">
                            {call.ai_summary ?? "—"}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {formatRelativeDate(call.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
