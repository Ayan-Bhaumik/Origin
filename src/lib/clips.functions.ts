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
import { createClipCore, createSchema, retrieveClipCore, type RetrieveResult } from "./clip-engine.server";

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

export const createClip = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }) => createClipCore(data));

export type { RetrieveResult };

export const retrieveClip = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ code: codeSchema, pin: z.string().max(8).optional() }).parse(d),
  )
  .handler(async ({ data }): Promise<RetrieveResult> => retrieveClipCore(data));

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
