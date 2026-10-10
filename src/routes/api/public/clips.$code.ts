import { createFileRoute } from "@tanstack/react-router";
import { API_CORS, apiError, json } from "@/lib/clip-api.server";

// Public REST endpoint for the browser extension: retrieve a clip. Optional ?pin=.
export const Route = createFileRoute("/api/public/clips/$code")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: API_CORS }),
      GET: async ({ request, params }) => {
        const { retrieveClipCore } = await import("@/lib/clip-engine.server");
        const code = params.code.trim();
        if (!code || code.length > 20) return apiError("not_found");
        const pin = new URL(request.url).searchParams.get("pin") ?? undefined;
        if (pin && pin.length > 8) return apiError("wrong_pin");
        const r = await retrieveClipCore({ code, pin });
        if (r.status === "pin_required") return apiError("pin_required", { pinProtected: true });
        if (r.status === "wrong_pin") return apiError("wrong_pin", { pinProtected: true, remaining: r.remaining });
        if (r.status !== "ok") return apiError(r.status);
        return json({
          code: r.code,
          type: r.type,
          content: r.content,
          fileUrl: r.url,
          fileName: r.fileName,
          fileMime: r.fileMime,
          fileSize: r.fileSize,
          expiresAt: r.expiresAt,
          burned: r.burned,
          pinProtected: !!pin,
        });
      },
    },
  },
});
