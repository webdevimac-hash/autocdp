const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://autocdp.com").replace(/\/$/, "");

export function commIdToToken(commId: string): string {
  return Buffer.from(commId.replace(/-/g, ""), "hex").toString("base64url");
}

export function tokenToCommId(token: string): string | null {
  try {
    const hex = Buffer.from(token, "base64url").toString("hex");
    if (hex.length !== 32) return null;
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return null;
  }
}

export function buildClickUrl(commId: string, destUrl: string): string {
  return `${APP_URL}/api/t/${commIdToToken(commId)}?u=${encodeURIComponent(destUrl)}`;
}

export function buildPixelUrl(commId: string): string {
  return `${APP_URL}/api/px/${commIdToToken(commId)}`;
}

export function buildSmsTrackingUrl(commId: string): string {
  return `${APP_URL}/api/t/${commIdToToken(commId)}`;
}

export function injectEmailTracking(html: string, commId: string): string {
  const wrapped = html.replace(
    /href="(https?:\/\/[^"]+)"/gi,
    (_, url) => `href="${buildClickUrl(commId, url)}"`
  );
  const pixel = `<img src="${buildPixelUrl(commId)}" width="1" height="1" style="display:none;border:0;" alt="" />`;
  return wrapped.includes("</body>")
    ? wrapped.replace("</body>", `${pixel}</body>`)
    : wrapped + pixel;
}
