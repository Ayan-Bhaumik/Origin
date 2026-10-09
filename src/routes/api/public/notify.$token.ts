import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sha256 } from "@/lib/clips.server";

// Public read-receipt status: only answers "viewed yet?" for whoever holds the random token.
export const Route = createFileRoute("/api/public/notify/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const headers = { "content-type": "application/json", "cache-control": "no-store" };
        if (!/^[0-9a-f]{48}$/.test(params.token)) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers });
        const { data } = await supabaseAdmin
          .from("clips")
          .select("viewed_at")
          .eq("notify_token", await sha256(params.token))
          .maybeSingle();
        if (!data) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers });
        return new Response(JSON.stringify({ viewed: !!data.viewed_at, viewed_at: data.viewed_at }), { headers });
      },
    },
  },
});
