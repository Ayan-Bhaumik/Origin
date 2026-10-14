import bcrypt from "bcryptjs";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BUCKET, guard, loadSettings, randomToken, sha256, sweep } from "./clips.server";
import {
  LOCK_MINUTES,
  MAX_FILES_PER_CLIP,
  MAX_IMAGES_PER_CLIP,
  MAX_PIN_ATTEMPTS,
  generateCode,
  isAllowedTimer,
  mimeAllowed,
  normalizeCode,
  sanitizeFileName,
  validateCustomCode,
  validateFileBatch,
  validatePin,
  isSafeNotifyUrl,
} from "./clip-rules";

// Shared clip engine used by both the web app's server functions and the public REST API.
export const createSchema = z.object({
  type: z.enum(["text", "image", "file"]),
  content: z.string().max(200000).optional(),
  files: z
    .array(
      z.object({
        path: z.string().max(400),
        name: z.string().max(255),
        mime: z.string().max(255).default("application/octet-stream"),
        size: z.number().int().nonnegative(),
      }),
    )
    .max(MAX_IMAGES_PER_CLIP + MAX_FILES_PER_CLIP)
    .optional(),
  customCode: z.string().max(20).optional(),
  pin: z.string().max(8).optional(),
  burnAfterRead: z.boolean(),
  timerSeconds: z.number().int().positive(),
  notify: z.boolean().optional(),
  notifyUrl: z.string().trim().max(500).optional(),
});

export type CreateInput = z.infer<typeof createSchema>;

const FILE_PATH_RE = /^clips\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/;

export async function createClipCore(data: CreateInput) {
    const g = await guard("create", 10);
    if (g !== "ok") return { ok: false as const, error: g };
    const s = await loadSettings();
    if (s.maintenance_mode) return { ok: false as const, error: "maintenance" };
    if (!isAllowedTimer(data.timerSeconds, s.allowed_timers))
      return { ok: false as const, error: "bad_timer" };
    if (data.pin) {
      const e = validatePin(data.pin);
      if (e) return { ok: false as const, error: e };
    }
    if (data.notifyUrl && !isSafeNotifyUrl(data.notifyUrl))
      return { ok: false as const, error: "Ping URL must be a public https:// address." };
    await sweep();

    let fileRows: { path: string; name: string; mime: string; size: number }[] = [];
    let fileSize: number | null = null;
    if (data.type === "text") {
      const text = data.content ?? "";
      if (!text.trim()) return { ok: false as const, error: "empty" };
      if (new TextEncoder().encode(text).length > s.max_text_bytes)
        return { ok: false as const, error: "too_large" };
    } else {
      const files = data.files ?? [];
      const batchErr = validateFileBatch(data.type, files, s);
      if (batchErr) return { ok: false as const, error: batchErr };
      const paths = files.map((f) => f.path);
      for (const f of files) {
        if (!FILE_PATH_RE.test(f.path)) return { ok: false as const, error: "bad_file" };
        if (data.type === "file" && !mimeAllowed(f.mime || "application/octet-stream", s.mime_allowlist))
          return { ok: false as const, error: "bad_type" };
      }
      // A stored file may only ever belong to one clip.
      const { data: dups } = await supabaseAdmin.from("clip_files").select("path").in("path", paths);
      if (dups?.length) return { ok: false as const, error: "bad_file" };
      const { data: legacyDups } = await supabaseAdmin.from("clips").select("file_path").in("file_path", paths);
      if (legacyDups?.length) return { ok: false as const, error: "bad_file" };
      for (const f of files) {
        const [, folder, name] = f.path.split("/");
        const { data: listed } = await supabaseAdmin.storage
          .from(BUCKET)
          .list(`clips/${folder}`, { search: name ?? "" });
        const obj = listed?.find((o) => o.name === name);
        if (!obj) return { ok: false as const, error: "bad_file" };
        const size = Number((obj.metadata as { size?: number } | null)?.size ?? 0);
        const max = data.type === "image" ? s.max_image_bytes : s.max_file_bytes;
        if (size > max) return { ok: false as const, error: "too_large" };
        fileRows.push({ path: f.path, name: sanitizeFileName(f.name || "file"), mime: f.mime || "application/octet-stream", size });
      }
      fileSize = fileRows.reduce((sum, f) => sum + f.size, 0);
    }

    let code: string;
    if (data.customCode && data.customCode.trim()) {
      const e = validateCustomCode(data.customCode, s.blocked_codes);
      if (e) return { ok: false as const, error: e };
      code = normalizeCode(data.customCode);
    } else {
      code = "";
      for (let i = 0; i < 8; i++) {
        const c = normalizeCode(generateCode());
        const { data: ex } = await supabaseAdmin.from("clips").select("id").eq("code", c).maybeSingle();
        if (!ex) {
          code = c;
          break;
        }
      }
      if (!code) return { ok: false as const, error: "code_failed" };
    }

    const deleteToken = randomToken();
    const notifyToken = data.notify ? randomToken() : null;
    const expiresAt = new Date(Date.now() + data.timerSeconds * 1000).toISOString();
    const { data: clip, error } = await supabaseAdmin
      .from("clips")
      .insert({
        code,
        type: data.type,
        content: data.type === "text" ? (data.content ?? "") : null,
        file_path: null,
        file_name: null,
        file_mime: null,
        file_size: data.type === "text" ? new TextEncoder().encode(data.content ?? "").length : fileSize,
        pin_hash: data.pin ? await bcrypt.hash(data.pin, 8) : null,
        pin_protected: !!data.pin,
        burn_after_read: data.burnAfterRead,
        delete_token: await sha256(deleteToken),
        expires_at: expiresAt,
        notify_token: notifyToken ? await sha256(notifyToken) : null,
        notify_url: notifyToken && data.notifyUrl ? data.notifyUrl : null,
      })
      .select("id")
      .single();
    if (error || !clip) {
      if (error?.code === "23505") return { ok: false as const, error: "taken" };
      console.error(error);
      return { ok: false as const, error: "save_failed" };
    }
    if (fileRows.length) {
      const { error: filesError } = await supabaseAdmin.from("clip_files").insert(
        fileRows.map((f, i) => ({ clip_id: clip.id, path: f.path, name: f.name, mime: f.mime, size: f.size, position: i })),
      );
      if (filesError) {
        console.error(filesError);
        return { ok: false as const, error: "save_failed" };
      }
    }
    return { ok: true as const, code: code.toUpperCase(), deleteToken, expiresAt, notifyToken };
}

export type ClipFileView = { url: string | null; name: string; mime: string; size: number };

export type RetrieveResult =
  | { status: "ok"; type: "text" | "image" | "file"; content: string | null; files: ClipFileView[]; url: string | null; fileName: string | null; fileMime: string | null; fileSize: number | null; expiresAt: string; burned: boolean; code: string }
  | { status: "pin_required" }
  | { status: "wrong_pin"; remaining: number }
  | { status: "locked" }
  | { status: "not_found" }
  | { status: "burned" }
  | { status: "rate_limited" }
  | { status: "blocked" };

export async function retrieveClipCore(data: { code: string; pin?: string | undefined }): Promise<RetrieveResult> {
    const g = await guard("retrieve", 30);
    if (g !== "ok") return { status: g };
    await sweep();
    const code = normalizeCode(data.code);
    const { data: clip } = await supabaseAdmin.from("clips").select("*").eq("code", code).maybeSingle();
    if (!clip) return { status: "not_found" };
    if (clip.status === "deleted" && clip.burn_after_read && clip.view_count > 0)
      return { status: "burned" };
    if (clip.status !== "active" || new Date(clip.expires_at) < new Date())
      return { status: "not_found" };

    if (clip.pin_protected) {
      if (clip.locked_until && new Date(clip.locked_until) > new Date()) return { status: "locked" };
      if (!data.pin) return { status: "pin_required" };
      const ok = clip.pin_hash ? await bcrypt.compare(data.pin, clip.pin_hash) : false;
      if (!ok) {
        const attempts = clip.failed_pin_attempts + 1;
        if (attempts >= MAX_PIN_ATTEMPTS) {
          await supabaseAdmin
            .from("clips")
            .update({
              failed_pin_attempts: 0,
              locked_until: new Date(Date.now() + LOCK_MINUTES * 60000).toISOString(),
            })
            .eq("id", clip.id);
          return { status: "locked" };
        }
        await supabaseAdmin.from("clips").update({ failed_pin_attempts: attempts }).eq("id", clip.id);
        return { status: "wrong_pin", remaining: MAX_PIN_ATTEMPTS - attempts };
      }
    }

    // Attached files: new multi-file table, falling back to the legacy single-file columns.
    const { data: rows } = await supabaseAdmin
      .from("clip_files")
      .select("path, name, mime, size")
      .eq("clip_id", clip.id)
      .order("position");
    const files: ClipFileView[] = [];
    if (rows?.length) {
      for (const r of rows) {
        const { data: signed } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(r.path, 60, { download: clip.type === "file" ? r.name : false });
        files.push({ url: signed?.signedUrl ?? null, name: r.name, mime: r.mime, size: r.size });
      }
    } else if (clip.file_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(clip.file_path, 60, { download: clip.type === "file" ? clip.file_name ?? true : false });
      files.push({
        url: signed?.signedUrl ?? null,
        name: clip.file_name ?? "file",
        mime: clip.file_mime ?? "application/octet-stream",
        size: clip.file_size ?? 0,
      });
    }
    const first = files[0] ?? null;

    const now = new Date().toISOString();
    if (clip.burn_after_read) {
      // Conditional update so only one viewer wins the burn.
      const { data: burned } = await supabaseAdmin
        .from("clips")
        .update({
          status: "deleted",
          view_count: clip.view_count + 1,
          last_accessed_at: now,
          expired_at: now,
          content: null,
          file_path: null,
          pin_hash: null,
          delete_token: null,
          failed_pin_attempts: 0,
        })
        .eq("id", clip.id)
        .eq("status", "active")
        .select("id");
      if (!burned || !burned.length) return { status: "burned" };
      const paths = [...(rows?.map((r) => r.path) ?? []), ...(clip.file_path ? [clip.file_path] : [])];
      if (paths.length) {
        await supabaseAdmin.from("storage_purge").insert(
          paths.map((p) => ({ file_path: p, purge_after: new Date(Date.now() + 2 * 60000).toISOString() })),
        );
        if (rows?.length) await supabaseAdmin.from("clip_files").delete().eq("clip_id", clip.id);
      }
    } else {
      await supabaseAdmin
        .from("clips")
        .update({ view_count: clip.view_count + 1, last_accessed_at: now, failed_pin_attempts: 0 })
        .eq("id", clip.id);
    }

    if (clip.notify_token && !clip.viewed_at) await sendReceipt(clip.id, clip.code, clip.notify_url);

    return {
      status: "ok",
      type: clip.type as "text" | "image" | "file",
      content: clip.content,
      files,
      url: first?.url ?? null,
      fileName: first?.name ?? null,
      fileMime: first?.mime ?? null,
      fileSize: first?.size ?? null,
      expiresAt: clip.expires_at,
      burned: clip.burn_after_read,
      code: clip.code.toUpperCase(),
    };
}

/** Marks the first view once and pings the sender's URL once (no retries). */
async function sendReceipt(id: string, code: string, url: string | null) {
  const now = new Date().toISOString();
  const { data: won } = await supabaseAdmin
    .from("clips")
    .update({ viewed_at: now })
    .eq("id", id)
    .is("viewed_at", null)
    .select("id");
  if (!won?.length || !url || !isSafeNotifyUrl(url)) return;
  try {
    const u = new URL(url);
    u.searchParams.set("code", code.toUpperCase());
    u.searchParams.set("viewed_at", now);
    await fetch(u, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(3000) });
  } catch {
    // fire and forget
  }
  await supabaseAdmin.from("clips").update({ notified_at: now }).eq("id", id);
}
