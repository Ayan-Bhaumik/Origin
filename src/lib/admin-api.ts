import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Clip = Tables<"clips">;

export async function logAudit(action: string, target: string | null, detail?: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("audit_log").insert({ admin_id: data.user.id, action, target, detail: detail ?? null });
}

export async function isCurrentUserAdmin() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const { data: role } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();
  return !!role;
}

/** Deletes the clip's stored file and erases its content. */
export async function adminDeleteClip(clip: Pick<Clip, "id" | "code" | "file_path">) {
  if (clip.file_path) await supabase.storage.from("clips-files").remove([clip.file_path]);
  const { error } = await supabase
    .from("clips")
    .update({
      status: "deleted",
      content: null,
      file_path: null,
      pin_hash: null,
      delete_token: null,
      expired_at: new Date().toISOString(),
    })
    .eq("id", clip.id);
  if (error) throw error;
  await logAudit("delete", clip.code);
}

export async function adminForceExpire(clip: Pick<Clip, "id" | "code" | "file_path">) {
  if (clip.file_path) await supabase.storage.from("clips-files").remove([clip.file_path]);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("clips")
    .update({ status: "expired", expires_at: now, expired_at: now, content: null, file_path: null, pin_hash: null, delete_token: null })
    .eq("id", clip.id);
  if (error) throw error;
  await logAudit("force_expire", clip.code);
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
