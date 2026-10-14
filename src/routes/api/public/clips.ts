import { createFileRoute } from "@tanstack/react-router";
import { API_CORS, apiError, json } from "@/lib/clip-api.server";

// Public REST endpoint for the browser extension: create a clip.
export const Route = createFileRoute("/api/public/clips")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: API_CORS }),
      POST: async ({ request }) => {
        const { createClipCore, createSchema } = await import("@/lib/clip-engine.server");
        const { BUCKET, guard, loadSettings } = await import("@/lib/clips.server");
        const { mimeAllowed, sanitizeFileName, validateFileBatch } = await import("@/lib/clip-rules");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let fields: Record<string, unknown> = {};
        let files: File[] = [];
        const ct = request.headers.get("content-type") ?? "";
        try {
          if (ct.includes("multipart/form-data")) {
            const fd = await request.formData();
            for (const [k, v] of fd.entries()) {
              if (typeof v === "string") fields[k] = v;
              else if (k === "file") files.push(v as File);
            }
          } else {
            fields = (await request.json()) as Record<string, unknown>;
          }
        } catch {
          return apiError("Invalid request body.");
        }

        const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
        const type = str(fields["type"]) ?? (files.length ? (files.every((f) => f.type.startsWith("image/")) ? "image" : "file") : "text");
        if (type !== "text" && type !== "image" && type !== "file") return apiError("Invalid type.");
        const s = await loadSettings();
        const timer = Number(fields["timer"] ?? s.default_timer_seconds);
        const burn = fields["burnAfterRead"] === true || fields["burnAfterRead"] === "true";

        const uploads: { path: string; name: string; mime: string; size: number }[] = [];
        if (type !== "text") {
          if (!files.length) return apiError("A file is required for image and file clips.");
          const g = await guard("upload", 10);
          if (g !== "ok") return apiError(g);
          if (s.maintenance_mode) return apiError("maintenance");
          const batchErr = validateFileBatch(
            type,
            files.map((f) => ({ name: f.name || "file", mime: f.type || "application/octet-stream", size: f.size })),
            s,
          );
          if (batchErr) return apiError(batchErr);
          for (const file of files) {
            const max = type === "image" ? s.max_image_bytes : s.max_file_bytes;
            if (file.size > max) {
              await removeUploaded(uploads.map((u) => u.path));
              return apiError("too_large");
            }
            if (type === "image" && !file.type.startsWith("image/")) {
              await removeUploaded(uploads.map((u) => u.path));
              return apiError("bad_type");
            }
            if (type === "file" && !mimeAllowed(file.type || "application/octet-stream", s.mime_allowlist)) {
              await removeUploaded(uploads.map((u) => u.path));
              return apiError("bad_type");
            }
            const path = `clips/${crypto.randomUUID()}/${sanitizeFileName(file.name || "file")}`;
            const { error } = await supabaseAdmin.storage
              .from(BUCKET)
              .upload(path, file, { contentType: file.type || "application/octet-stream" });
            if (error) {
              await removeUploaded(uploads.map((u) => u.path));
              return apiError("upload_failed");
            }
            uploads.push({ path, name: file.name || "file", mime: file.type || "application/octet-stream", size: file.size });
          }
        }

        const parsed = createSchema.safeParse({
          type,
          content: type === "text" ? (typeof fields["content"] === "string" ? fields["content"] : "") : undefined,
          files: uploads.length ? uploads : undefined,
          customCode: str(fields["customCode"]),
          pin: str(fields["pin"]),
          burnAfterRead: burn,
          timerSeconds: Number.isFinite(timer) ? Math.round(timer) : 0,
        });
        if (!parsed.success) {
          await removeUploaded(uploads.map((u) => u.path));
          return apiError("Invalid fields.");
        }
        const r = await createClipCore(parsed.data);
        if (!r.ok) {
          await removeUploaded(uploads.map((u) => u.path));
          return apiError(r.error);
        }
        return json({ code: r.code, expiresAt: r.expiresAt, deleteToken: r.deleteToken }, 201);
      },
    },
  },
});

async function removeUploaded(paths: string[]) {
  if (!paths.length) return;
  const { BUCKET, supabaseAdmin } = await import("@/lib/clips.server").then(async (m) => ({
    BUCKET: m.BUCKET,
    supabaseAdmin: (await import("@/integrations/supabase/client.server")).supabaseAdmin,
  }));
  await supabaseAdmin.storage.from(BUCKET).remove(paths);
}
