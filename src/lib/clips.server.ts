import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEFAULT_SETTINGS, type AppSettings } from "./clip-rules";

export const BUCKET = "clips-files";

export function clientIp() {
  return (
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    getRequestHeader("x-real-ip") ||
    "unknown"
  );
}

export async function loadSettings(): Promise<AppSettings> {
  const { data } = await supabaseAdmin.from("settings").select("key, value");
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of data ?? []) s[row.key] = row.value;
  return s as AppSettings;
}

export type GuardResult = "ok" | "blocked" | "rate_limited";

/** IP block list + sliding-window rate limit. */
export async function guard(action: string, max: number, windowSeconds = 60): Promise<GuardResult> {
  const ip = clientIp();
  const { data: rule } = await supabaseAdmin.from("ip_rules").select("id").eq("ip", ip).maybeSingle();
  if (rule) return "blocked";
  const { data: limited } = await supabaseAdmin.rpc("hit_rate_limit", {
    _ip: ip,
    _action: action,
    _max: max,
    _window_seconds: windowSeconds,
  });
  return limited ? "rate_limited" : "ok";
}

/** Expire overdue clips and remove queued files from storage. Safe to call often. */
export async function sweep() {
  try {
    await supabaseAdmin.rpc("expire_clips");
    const { data: rows } = await supabaseAdmin
      .from("storage_purge")
      .select("id, file_path")
      .lte("purge_after", new Date().toISOString())
      .limit(50);
    if (rows && rows.length) {
      await supabaseAdmin.storage.from(BUCKET).remove(rows.map((r) => r.file_path));
      await supabaseAdmin.from("storage_purge").delete().in("id", rows.map((r) => r.id));
    }
  } catch (e) {
    console.error("sweep failed", e);
  }
}

export async function sha256(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
