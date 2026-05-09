import type { Metadata } from "next";

export const metadata: Metadata = { title: "RSVP Confirmed" };

export default async function RsvpThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const { r } = await searchParams;
  const attending = r === "yes";
  const declined  = r === "no";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F8FAFC",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "32px 16px",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "#ffffff",
          borderRadius: 20,
          border: "1px solid #E2E8F0",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          padding: "48px 40px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: 36,
            background: attending ? "#ECFDF5" : declined ? "#F8FAFC" : "#FEF3C7",
            border: `2px solid ${attending ? "#6EE7B7" : declined ? "#E2E8F0" : "#FCD34D"}`,
          }}
        >
          {attending ? "🎉" : declined ? "😊" : "✉️"}
        </div>

        <h1
          style={{
            margin: "0 0 12px",
            fontSize: 24,
            fontWeight: 700,
            color: "#0F172A",
            letterSpacing: "-0.02em",
          }}
        >
          {attending
            ? "You're on the list!"
            : declined
            ? "Thanks for letting us know"
            : "Response recorded"}
        </h1>

        <p
          style={{
            margin: "0 0 32px",
            fontSize: 16,
            color: "#64748B",
            lineHeight: 1.6,
          }}
        >
          {attending
            ? "We've saved your spot. We'll send a reminder as the date gets closer — looking forward to seeing you!"
            : declined
            ? "No worries at all. We hope to see you at a future event. Keep an eye out for next month's newsletter!"
            : "We've recorded your response. Thanks for getting back to us."}
        </p>

        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "#94A3B8",
          }}
        >
          You can close this window.
        </p>
      </div>
    </div>
  );
}
