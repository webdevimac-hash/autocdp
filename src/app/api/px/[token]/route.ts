import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { tokenToCommId } from "@/lib/tracking";

// 1×1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const commId = tokenToCommId(token);

  if (commId) {
    try {
      const svc = createServiceClient();
      const { data: comm } = await svc
        .from("communications")
        .select("opened_at")
        .eq("id", commId)
        .single();

      if (comm && !comm.opened_at) {
        await svc
          .from("communications")
          .update({ opened_at: new Date().toISOString() })
          .eq("id", commId);
      }
    } catch {
      // never let a pixel error break the email render
    }
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
    },
  });
}
