import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  BUCKET,
  guard,
  loadSettings,
  randomToken,
  sha256,
  sweep,
} from "./clips.server";
import {
  LOCK_MINUTES,
  MAX_PIN_ATTEMPTS,
  generateCode,
  isAllowedTimer,
  mimeAllowed,
  normalizeCode,
  sanitizeFileName,
  validateCustomCode,
  validatePin,
  isSafeNotifyUrl,
} from "./clip-rules";

const codeSchema = z.string().trim().min(1).max(20);

export const getPublicSettings = createServerFn({ method: "GET" }).handler(async () => {
  const s = await loadSettings();
  return {
    default_timer_seconds: s.default_timer_seconds,
    allowed_timers: s.allowed_timers,
    max_text_bytes: s.max_text_bytes,
    max_image_bytes: s.max_image_bytes,
    max_file_bytes: s.max_file_bytes,
    blocked_codes: s.blocked_codes,
    mime_allowlist: s.mime_allowlist,
    maintenance_mode: s.maintenance_mode,
    announcement_banner: s.announcement_banner,
  };
});

export const checkCodeAvailable = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: codeSchema }).parse(d))
  .handler(async ({ data }) => {
    const g = await guard("check", 60);
    if (g !== "ok") return { available: false, error: g };
    const s = await loadSettings();
    const err = validateCustomCode(data.code, s.blocked_codes);
    if (err) return { available: false, error: err };
    await sweep();
    const { data: row } = await supabaseAdmin
      .from("clips")
      .select("id")
      .eq("code", normalizeCode(data.code))
      .maybeSingle();
    return { available: !row, error: null };
  });

export const createUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["image", "file"]),
        fileName: z.string().min(1).max(255),
        size: z.number().int().positive(),
        mime: z.string().max(255),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const g = await guard("upload", 10);
    if (g !== "ok") return { ok: false as const, error: g };
    const s = await loadSettings();
    if (s.maintenance_mode) return { ok: false as const, error: "maintenance" };
    const max = data.kind === "image" ? s.max_image_bytes : s.max_file_bytes;
    if (data.size > max) return { ok: false as const, error: "too_large" };
    if (data.kind === "image" && !data.mime.startsWith("image/"))
      return { ok: false as const, error: "bad_type" };
    if (data.kind === "file" && !mimeAllowed(data.mime || "application/octet-stream", s.mime_allowlist))
      return { ok: false as const, error: "bad_type" };
    const path = `clips/${crypto.randomUUID()}/${sanitizeFileName(data.fileName)}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) return { ok: false as const, error: "upload_failed" };
    return { ok: true as const, path, token: signed.token };
  });

const createSchema = z.object({
  type: z.enum(["text", "image", "file"]),
  content: z.string().max(200000).optional(),
  filePath: z.string().max(400).optional(),
  fileName: z.string().max(255).optional(),
  fileMime: z.string().max(255).optional(),
  customCode: z.string().max(20).optional(),
  pin: z.string().max(8).optional(),
  burnAfterRead: z.boolean(),
  timerSeconds: z.number().int().positive(),
  notify: z.boolean().optional(),
  notifyUrl: z.string().trim().max(500).optional(),
});

export const createClip = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }) => {
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

    let fileSize: number | null = null;
    if (data.type === "text") {
      const text = data.content ?? "";
      if (!text.trim()) return { ok: false as const, error: "empty" };
      if (new TextEncoder().encode(text).length > s.max_text_bytes)
        return { ok: false as const, error: "too_large" };
    } else {
      if (!data.filePath || !/^clips\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/.test(data.filePath))
        return { ok: false as const, error: "bad_file" };
      const [, folder, name] = data.filePath.split("/");
      const { data: listed } = await supabaseAdmin.storage
        .from(BUCKET)
        .list(`clips/${folder}`, { search: name ?? "" });
      const obj = listed?.find((o) => o.name === name);
      if (!obj) return { ok: false as const, error: "bad_file" };
      fileSize = Number((obj.metadata as { size?: number } | null)?.size ?? 0);
      const max = data.type === "image" ? s.max_image_bytes : s.max_file_bytes;
      if (fileSize > max) {
        await supabaseAdmin.storage.from(BUCKET).remove([data.filePath]);
        return { ok: false as const, error: "too_large" };
      }
      const { data: dup } = await supabaseAdmin
        .from("clips")
        .select("id")
        .eq("file_path", data.filePath)
        .maybeSingle();
      if (dup) return { ok: false as const, error: "bad_file" };
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
    const { error } = await supabaseAdmin.from("clips").insert({
      code,
      type: data.type,
      content: data.type === "text" ? (data.content ?? "") : null,
      file_path: data.type === "text" ? null : (data.filePath ?? null),
      file_name: data.type === "text" ? null : sanitizeFileName(data.fileName ?? "file"),
      file_mime: data.type === "text" ? "text/plain" : data.fileMime || "application/octet-stream",
      file_size: data.type === "text" ? new TextEncoder().encode(data.content ?? "").length : fileSize,
      pin_hash: data.pin ? await bcrypt.hash(data.pin, 8) : null,
      pin_protected: !!data.pin,
      burn_after_read: data.burnAfterRead,
      delete_token: await sha256(deleteToken),
      expires_at: expiresAt,
      notify_token: notifyToken ? await sha256(notifyToken) : null,
      notify_url: notifyToken && data.notifyUrl ? data.notifyUrl : null,
    });
    if (error) {
      if (error.code === "23505") return { ok: false as const, error: "taken" };
      console.error(error);
      return { ok: false as const, error: "save_failed" };
    }
    return { ok: true as const, code: code.toUpperCase(), deleteToken, expiresAt, notifyToken };
  });

export type RetrieveResult =
  | { status: "ok"; type: "text" | "image" | "file"; content: string | null; url: string | null; fileName: string | null; fileMime: string | null; fileSize: number | null; expiresAt: string; burned: boolean; code: string }
  | { status: "pin_required" }
  | { status: "wrong_pin"; remaining: number }
  | { status: "locked" }
  | { status: "not_found" }
  | { status: "burned" }
  | { status: "rate_limited" }
  | { status: "blocked" };

export const retrieveClip = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ code: codeSchema, pin: z.string().max(8).optional() }).parse(d),
  )
  .handler(async ({ data }): Promise<RetrieveResult> => {
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

    let url: string | null = null;
    if (clip.file_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(clip.file_path, 60, { download: clip.type === "file" ? clip.file_name ?? true : false });
      url = signed?.signedUrl ?? null;
    }

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
      if (clip.file_path) {
        await supabaseAdmin.from("storage_purge").insert({
          file_path: clip.file_path,
          purge_after: new Date(Date.now() + 2 * 60000).toISOString(),
        });
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
      url,
      fileName: clip.file_name,
      fileMime: clip.file_mime,
      fileSize: clip.file_size,
      expiresAt: clip.expires_at,
      burned: clip.burn_after_read,
      code: clip.code.toUpperCase(),
    };
  });

export const deleteOwnClip = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ code: codeSchema, token: z.string().min(16).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    const g = await guard("delete", 20);
    if (g !== "ok") return { ok: false, error: g };
    const hash = await sha256(data.token);
    const { data: clip } = await supabaseAdmin
      .from("clips")
      .select("id, file_path, delete_token")
      .eq("code", normalizeCode(data.code))
      .eq("status", "active")
      .maybeSingle();
    if (!clip || clip.delete_token !== hash) return { ok: false, error: "not_found" };
    if (clip.file_path) await supabaseAdmin.storage.from(BUCKET).remove([clip.file_path]);
    await supabaseAdmin
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
    return { ok: true, error: null };
  });

export const reportClip = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ code: codeSchema, reason: z.string().trim().min(1).max(1000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const g = await guard("report", 5);
    if (g !== "ok") return { ok: false, error: g };
    const { error } = await supabaseAdmin
      .from("reports")
      .insert({ clip_code: normalizeCode(data.code), reason: data.reason });
    return { ok: !error, error: error ? "save_failed" : null };
  });

export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  return { exists: (count ?? 0) > 0 };
});

/** One-time setup: creates the first admin account. Refuses once any admin exists. */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().trim().email().max(255), password: z.string().min(10).max(128) }).parse(d),
  )
  .handler(async ({ data }) => {
    const g = await guard("bootstrap", 5, 600);
    if (g !== "ok") return { ok: false, error: "Too many requests. Please slow down." };
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) return { ok: false, error: "An admin account already exists." };
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) return { ok: false, error: error?.message ?? "Could not create account." };
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    return { ok: true, error: null };
  });

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

export const getReceipt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(16).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("clips")
      .select("viewed_at")
      .eq("notify_token", await sha256(data.token))
      .maybeSingle();
    return { found: !!row, viewedAt: row?.viewed_at ?? null };
  });
