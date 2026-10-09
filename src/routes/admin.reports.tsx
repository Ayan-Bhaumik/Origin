import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton } from "@/components/confirm-button";
import { supabase } from "@/integrations/supabase/client";
import { adminDeleteClip, logAudit } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [
    { title: "Reports — origin admin" },
    { name: "description", content: "Review reported clips and moderation actions in origin." },
    { property: "og:title", content: "Reports — origin admin" },
    { property: "og:description", content: "Review reported clips and moderation actions in origin." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ReportsPage,
});

function ReportsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });

  const dismiss = async (id: string, code: string) => {
    const { error } = await supabase.from("reports").update({ status: "dismissed" }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit("report_dismiss", code);
    toast.success("Report dismissed");
    refresh();
  };
  const deleteClip = async (id: string, code: string) => {
    const { data: clip } = await supabase.from("clips").select("id, code, file_path").eq("code", code).maybeSingle();
    if (clip) await adminDeleteClip(clip);
    await supabase.from("reports").update({ status: "reviewed" }).eq("id", id);
    await logAudit("report_delete_clip", code);
    toast.success(clip ? "Clip deleted" : "Clip no longer exists — report closed");
    refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <div className="surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clip code</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5}><Skeleton className="h-5" /></TableCell></TableRow>}
            {!isLoading && !data?.length && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No reports yet.</TableCell></TableRow>}
            {data?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono font-semibold uppercase">{r.clip_code}</TableCell>
                <TableCell className="max-w-xs whitespace-pre-wrap break-words">{r.reason}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                <TableCell><Badge variant={r.status === "pending" ? "default" : "secondary"} className="capitalize">{r.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button asChild variant="ghost" size="sm"><Link to="/admin/clips" search={{ code: r.clip_code }}>View</Link></Button>
                    {r.status === "pending" && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => dismiss(r.id, r.clip_code)}>Dismiss</Button>
                        <ConfirmButton title="Delete reported clip?" description="The clip's content will be erased permanently." onConfirm={() => deleteClip(r.id, r.clip_code)} variant="ghost" size="sm" className="text-destructive">Delete clip</ConfirmButton>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
