import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { realtimeOptionsForCurrentRuntime } from "@/integrations/supabase/realtime-options";

// Deletes question-bank uploads (storage file + row) older than 24 hours.
// Extracted questions in the `questions` table are kept — only the source
// file and its bank record are cleaned up.
export const Route = createFileRoute("/api/public/hooks/cleanup-banks")({
  server: {
    handlers: {
      POST: async () => {
        const url = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
          return new Response(
            JSON.stringify({ error: "Server not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        const admin = createClient(url, serviceKey, {
          realtime: realtimeOptionsForCurrentRuntime(),
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: stale, error: selErr } = await admin
          .from("question_banks")
          .select("id, file_path")
          .lt("created_at", cutoff)
          .not("file_path", "is", null);

        if (selErr) {
          return new Response(
            JSON.stringify({ error: selErr.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        let removedFiles = 0;
        let clearedRows = 0;
        const rows = stale ?? [];
        const paths = rows.map((r) => r.file_path as string).filter(Boolean);

        if (paths.length) {
          const { data: rm, error: rmErr } = await admin.storage
            .from("question-banks")
            .remove(paths);
          if (rmErr) {
            return new Response(
              JSON.stringify({ error: `Storage delete: ${rmErr.message}` }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }
          removedFiles = rm?.length ?? 0;

          // Null out file_path so the bank record no longer references
          // a missing file, but keep extraction results/metadata.
          const ids = rows.map((r) => r.id as string);
          const { error: updErr } = await admin
            .from("question_banks")
            .update({ file_path: null })
            .in("id", ids);
          if (updErr) {
            return new Response(
              JSON.stringify({ error: `Row update: ${updErr.message}` }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }
          clearedRows = ids.length;
        }

        return new Response(
          JSON.stringify({
            ok: true,
            cutoff,
            removedFiles,
            clearedRows,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
