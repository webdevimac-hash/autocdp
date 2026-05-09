const SUPER_ADMIN_EMAILS = (
  process.env.AUTOCDP_SUPER_ADMINS ?? "webdevimac@outlook.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}
