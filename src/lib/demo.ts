import { cookies } from "next/headers";

export async function isDemoMode(): Promise<boolean> {
  try {
    const store = await cookies();
    return store.get("demo_mode")?.value === "1";
  } catch {
    return false;
  }
}
