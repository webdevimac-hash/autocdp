/**
 * Realistic-looking fake data for Demo Mode.
 * Used during sales demos so prospects see a populated, polished UI.
 */

export const DEMO_DEALERSHIP_NAME = "Sunrise Motors Group";

// ── Customer segments ──────────────────────────────────────────

const stages = ["vip", "active", "at_risk", "lapsed"] as const;
const stageDist = { vip: 124, active: 548, at_risk: 187, lapsed: 388 };

function mkCustomers() {
  const names = [
    ["James", "Wilson"], ["Sarah", "Chen"], ["Michael", "Torres"], ["Emily", "Johnson"],
    ["Robert", "Martinez"], ["Jessica", "Lee"], ["David", "Anderson"], ["Amanda", "Taylor"],
    ["Christopher", "Harris"], ["Melissa", "Clark"], ["Daniel", "Robinson"], ["Ashley", "Lewis"],
    ["Matthew", "Walker"], ["Stephanie", "Hall"], ["Joshua", "Young"], ["Jennifer", "King"],
    ["Andrew", "Wright"], ["Nicole", "Scott"], ["Ryan", "Green"], ["Lauren", "Baker"],
  ];
  const out: Array<{ id: string; lifecycle_stage: string; total_spend: number }> = [];
  let idx = 0;
  for (const [stage, count] of Object.entries(stageDist)) {
    for (let i = 0; i < count; i++) {
      const spend =
        stage === "vip"      ? 8000 + Math.random() * 24000 :
        stage === "active"   ? 1500 + Math.random() * 8000  :
        stage === "at_risk"  ? 500  + Math.random() * 3000  :
                               200  + Math.random() * 1500;
      out.push({ id: `demo-cust-${idx++}`, lifecycle_stage: stage, total_spend: Math.round(spend) });
    }
  }
  return out;
}

export const DEMO_CUSTOMERS_DATA = mkCustomers();
export const DEMO_CUSTOMERS_COUNT = DEMO_CUSTOMERS_DATA.length;

// ── Campaigns ─────────────────────────────────────────────────

export const DEMO_CAMPAIGNS = [
  { id: "demo-camp-1", name: "VIP Appreciation — Spring Service", status: "active",    channel: "direct_mail",  stats: { sent: 124 }, updated_at: new Date(Date.now() - 2 * 3600_000).toISOString() },
  { id: "demo-camp-2", name: "Lapsed Customer Win-Back",           status: "active",    channel: "multi_channel", stats: { sent: 388 }, updated_at: new Date(Date.now() - 5 * 3600_000).toISOString() },
  { id: "demo-camp-3", name: "Service Reminder — At-Risk Segment", status: "completed", channel: "sms",           stats: { sent: 187 }, updated_at: new Date(Date.now() - 26 * 3600_000).toISOString() },
  { id: "demo-camp-4", name: "Aged Inventory — 2023 Honda CR-Vs",  status: "completed", channel: "direct_mail",  stats: { sent: 67  }, updated_at: new Date(Date.now() - 3 * 86400_000).toISOString() },
  { id: "demo-camp-5", name: "Oil Change Special — Active Base",   status: "scheduled", channel: "email",         stats: { sent: 0   }, updated_at: new Date(Date.now() - 4 * 86400_000).toISOString() },
  { id: "demo-camp-6", name: "Conquest — Zip Code 94103",          status: "draft",     channel: "direct_mail",  stats: { sent: 0   }, updated_at: new Date(Date.now() - 7 * 86400_000).toISOString() },
];

// ── Communications (last 30 days) ─────────────────────────────

function mkComms() {
  const out: Array<{ id: string; status: string; channel: string; created_at: string }> = [];
  const channels = ["direct_mail", "sms", "email"] as const;
  for (let i = 0; i < 2847; i++) {
    const daysAgo = Math.random() * 30;
    const ts = new Date(Date.now() - daysAgo * 86400_000).toISOString();
    const channel = channels[Math.floor(Math.random() * channels.length)];
    const status = Math.random() > 0.07 ? "sent" : "failed";
    out.push({ id: `demo-comm-${i}`, status, channel, created_at: ts });
  }
  return out;
}

export const DEMO_COMMS = mkComms();

// ── Agent runs ─────────────────────────────────────────────────

export const DEMO_AGENT_RUNS = [
  { id: "demo-run-1", agent_type: "orchestrator", status: "completed", created_at: new Date(Date.now() - 90 * 60_000).toISOString(),  output_summary: "Dispatched 124 VIP appreciation letters via PostGrid" },
  { id: "demo-run-2", agent_type: "targeting",    status: "completed", created_at: new Date(Date.now() - 3 * 3600_000).toISOString(), output_summary: "Identified 388 lapsed customers matching win-back criteria" },
  { id: "demo-run-3", agent_type: "creative",     status: "completed", created_at: new Date(Date.now() - 5 * 3600_000).toISOString(), output_summary: "Generated personalized copy variants for lapsed segment" },
  { id: "demo-run-4", agent_type: "data",         status: "completed", created_at: new Date(Date.now() - 26 * 3600_000).toISOString(), output_summary: "Synced 1,247 customer records from CDK Drive" },
  { id: "demo-run-5", agent_type: "optimization", status: "completed", created_at: new Date(Date.now() - 2 * 86400_000).toISOString(), output_summary: "Scan rate +4.2% — yellow accent outperformed indigo" },
  { id: "demo-run-6", agent_type: "orchestrator", status: "completed", created_at: new Date(Date.now() - 3 * 86400_000).toISOString(), output_summary: "Aged inventory campaign: 67 pieces matched to customer history" },
];

// ── Analytics fake data ────────────────────────────────────────

export const DEMO_ANALYTICS = {
  mailPiecesLive: 648,
  deliveryRate: 97.2,
  scanRate: 8.4,
  totalScans: 54,
  smsSent: 187,
  emailSent: 512,
  agentRunCount: 34,
  avgAgentDurationSec: 12,
  totalMailSpendCents: 77760, // 648 * $1.20
  totalAiSpendCents: 1700,   // 34 * $0.05
  globalLearnings: [
    { pattern_type: "color_lift",      description: "Yellow and orange fluorescent accent colors produce 31% higher callback rates vs. standard ink in automotive service campaigns.", confidence: 0.91, sample_size: 4200 },
    { pattern_type: "timing",          description: "Direct mail sent Tuesday–Thursday arrives when homeowners are most likely to be home, boosting scan rates by 18%.", confidence: 0.87, sample_size: 3100 },
    { pattern_type: "copy_hook",       description: "Personalizing with vehicle make/model in the opening line increases reply rate by 22% over generic service copy.", confidence: 0.84, sample_size: 6700 },
    { pattern_type: "offer_structure", description: "Two-line discount offer with explicit dollar amount outperforms percentage-off framing by 14% for service customers.", confidence: 0.79, sample_size: 2900 },
    { pattern_type: "re_engagement",   description: "Lapsed customers (18–36 months) respond best to win-back offers referencing their last specific service event.", confidence: 0.76, sample_size: 1800 },
  ],
  recentOutcomes: [
    { outcome_type: "scan_rate_improvement", result: { lift: "+4.2%", trigger: "yellow_accent", baseline: "3.1%", new_rate: "7.3%" }, created_at: new Date(Date.now() - 2 * 86400_000).toISOString() },
    { outcome_type: "lapsed_reactivation",   result: { customers_reactivated: 31, roi_estimate: "$86,800", campaign: "Winter Win-Back" }, created_at: new Date(Date.now() - 7 * 86400_000).toISOString() },
    { outcome_type: "aged_inventory_match",  result: { vehicles_matched: 67, appointments_booked: 9, revenue_est: "$223,000" }, created_at: new Date(Date.now() - 14 * 86400_000).toISOString() },
  ],
  scansByDay: (() => {
    const out: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000);
      const date = d.toISOString().slice(0, 10);
      const count = i < 7 ? Math.floor(Math.random() * 8 + 1)
                  : i < 14 ? Math.floor(Math.random() * 5)
                  : Math.floor(Math.random() * 3);
      out.push({ date, count });
    }
    return out;
  })(),
};
