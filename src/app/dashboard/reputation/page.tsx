import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { ReputationDashboard } from "@/components/reputation/reputation-dashboard";
import type {
  ReputationData,
  ReviewEntry,
} from "@/components/reputation/reputation-dashboard";
import { isDemoMode } from "@/lib/demo";

export const metadata = { title: "Reputation" };

// ─── Demo fallback ────────────────────────────────────────────────────────

const DEMO_REVIEWS: ReviewEntry[] = [
  {
    id: "r1",
    author: "Marcus T.",
    initials: "MT",
    rating: 5,
    body: "Sarah at Braman Miami was incredible. She handled our trade-in and got us into a new X5 in under 3 hours. The whole team was professional, no pressure.",
    date_label: "2 days ago",
    source: "Google",
    source_tone: "google",
  },
  {
    id: "r2",
    author: "Jessica R.",
    initials: "JR",
    rating: 5,
    body: "Service was prompt, communication was clear, and they even washed the car. Couldn't ask for more — will definitely be back.",
    date_label: "4 days ago",
    source: "DealerRater",
    source_tone: "dealerrater",
  },
  {
    id: "r3",
    author: "Kevin P.",
    initials: "KP",
    rating: 4,
    body: "Good experience overall. The finance process took a bit longer than expected, but the sales team was fantastic and very transparent on pricing.",
    date_label: "1 week ago",
    source: "Google",
    source_tone: "google",
  },
  {
    id: "r4",
    author: "Aisha M.",
    initials: "AM",
    rating: 5,
    body: "Best dealership experience I've had. They followed up via text exactly when they said they would. Felt like a real partnership, not a sales push.",
    date_label: "1 week ago",
    source: "Internal",
    source_tone: "internal",
  },
  {
    id: "r5",
    author: "Daniel L.",
    initials: "DL",
    rating: 3,
    body: "Got the car I wanted at a fair price, but the wait at delivery was longer than I'd like. Communication via the app afterwards has been great though.",
    date_label: "2 weeks ago",
    source: "Yelp",
    source_tone: "yelp",
  },
];

const DEMO_DATA: ReputationData = {
  total_reviews: 412,
  comments: 158,
  average_rating: 4.6,
  distribution: { 5: 74, 4: 18, 3: 5, 2: 2, 1: 1 },
  sales:           { value: "92%",  period_label: "Last 30 Days", trend: "up" },
  services:        { value: "88%",  period_label: "Last 30 Days", trend: "up" },
  non_sold_visits: { value: "76%",  period_label: "Last 30 Days", trend: "down" },
  reviews: DEMO_REVIEWS,
};

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function ReputationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const demoMode = await isDemoMode();

  // TODO: When a `reviews` table exists, query it here.
  //   - Pull last 90 days for the active dealership_id
  //   - Aggregate distribution from reviews.rating
  //   - Derive Sales / Services / Non-Sold Visits CSAT from your survey
  //     scores (or a Google/DealerRater webhook ingest).
  // For now we render demo data so the page is institutional out-of-box.
  const data: ReputationData = demoMode ? DEMO_DATA : DEMO_DATA;

  return (
    <>
      <Header
        title="Reputation"
        subtitle={`${data.total_reviews.toLocaleString()} reviews · avg ${data.average_rating.toFixed(1)} ★`}
        userEmail={user?.email}
      />
      <main className="flex-1">
        <ReputationDashboard data={data} />
      </main>
    </>
  );
}
