/**
 * GET /api/conquest/retargeting/pixel?did={dealershipId}
 *
 * Serves the retargeting pixel JS snippet for a given dealership.
 * Embed on any dealer website page:
 *   <script src="https://app.autocdp.com/api/conquest/retargeting/pixel?did=DEALERSHIP_ID" async></script>
 *
 * Returns JavaScript with:
 *   - 1-hour CDN cache (revalidate on origin)
 *   - No cookies set; session stored in sessionStorage only
 *   - Fires one event on load, click-tracks phone/chat/form interactions
 */

import { NextRequest, NextResponse } from "next/server";
import { buildPixelSnippet } from "@/lib/conquest/pixel";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get("did");

  if (!dealershipId) {
    return new NextResponse("// AutoCDP pixel: missing ?did parameter", {
      status: 400,
      headers: { "Content-Type": "application/javascript" },
    });
  }

  // Determine the app base URL (used for fetch endpoint inside the snippet)
  const appBase =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  const js = buildPixelSnippet(dealershipId, appBase);

  return new NextResponse(js, {
    status: 200,
    headers: {
      "Content-Type":  "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Robots-Tag":  "noindex",
      // Allow embed from any origin (dealer websites are external)
      "Access-Control-Allow-Origin": "*",
    },
  });
}
