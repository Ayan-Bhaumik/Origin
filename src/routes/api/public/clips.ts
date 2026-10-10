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
        const { mimeAllowed, sanitizeFileName } = await import("@/lib/clip-rules");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let fields: Record<string, unknown> = {};
        let file: File | null = null;
        const ct = request.headers.get("content-type") ?? "";
        try {
          if (ct.includes("multipart/form-data")) {
            const fd = await request.formData();
            for (const [k, v] of fd.entries()) {
              if (typeof v === "string") fields[k] = v;
              else if (k === "file") file = v as File;
            }
          } else {
            fields = (await request.json()) as Record<string, unknown>;
          }
        } catch {
          return apiError("Invalid request body.");
        }

        const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
        const type = str(fields["type"]) ?? (file ? (file.type.startsWith("image/") ? "image" : "file") : "text");
        if (type !== "text" && type !== "image" && type !== "file") return apiError("Invalid type.");
        const s = await loadSettings();
        const timer = Number(fields["timer"] ?? s.default_timer_seconds);
        const burn = fields["burnAfterRead"] === true || fields["burnAfterRead"] === "true";

        let filePath: string | undefined;
        if (type !== "text") {
          if (!file) return apiError("A file is required for image and file clips.");
          const g = await guard("upload", 10);
          if (g !== "ok") return apiError(g);
          if (s.maintenance_mode) return apiError("maintenance");
          const max = type === "image" ? s.max_image_bytes : s.max_file_bytes;
          if (file.size > max) return apiError("too_large");
          if (type === "image" && !file.type.startsWith("image/")) return apiError("bad_type");
          if (type === "file" && !mimeAllowed(file.type || "application/octet-stream", s.mime_allowlist))
            return apiError("bad_type");
          filePath = `clips/${crypto.randomUUID()}/${sanitizeFileName(file.name || "file")}`;
          const { error } = await supabaseAdmin.storage
            .from(BUCKET)
            .upload(filePath, file, { contentType: file.type || "application/octet-stream" });
          if (error) return apiError("upload_failed");
        }

        const parsed = createSchema.safeParse({
          type,
          content: type === "text" ? (typeof fields["content"] === "string" ? fields["content"] : "") : undefined,
          filePath,
          fileName: file?.name,
          fileMime: file?.type,
          customCode: str(fields["customCode"]),
          pin: str(fields["pin"]),
          burnAfterRead: burn,
          timerSeconds: Number.isFinite(timer) ? Math.round(timer) : 0,
        });
        if (!parsed.success) return apiError("Invalid fields.");
        const r = await createClipCore(parsed.data);
        if (!r.ok) {
          if (filePath) await supabaseAdmin.storage.from(BUCKET).remove([filePath]);
          return apiError(r.error);
        }
        return json({ code: r.code, expiresAt: r.expiresAt, deleteToken: r.deleteToken }, 201);
      },
    },
  },
});
