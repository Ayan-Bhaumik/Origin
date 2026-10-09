import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/audit-log")({
  head: () => ({ meta: [
    { title: "Audit log — origin admin" },
    { name: "description", content: "Review origin administrator activity and audit records." },
    { property: "og:title", content: "Audit log — origin admin" },
    { property: "og:description", content: "Review origin administrator activity and audit records." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: AuditPage,
});

function AuditPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: async () => (await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(1000)).data ?? [],
  });
  const exportCsv = () =>
    downloadCsv(
      `origin-audit-${format(new Date(), "yyyyMMdd-HHmm")}.csv`,
      (data ?? []).map((r) => ({ action: r.action, target: r.target, detail: r.detail, timestamp: r.created_at })),
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.length}><Download /> Export CSV</Button>
      </div>
      <div className="surface overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>Detail</TableHead><TableHead>Timestamp</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4}><Skeleton className="h-5" /></TableCell></TableRow>}
            {!isLoading && !data?.length && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No admin actions yet.</TableCell></TableRow>}
            {data?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.action.replace(/_/g, " ")}</TableCell>
                <TableCell className="font-mono uppercase">{r.target ?? "—"}</TableCell>
                <TableCell className="max-w-sm truncate text-muted-foreground">{r.detail ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy HH:mm:ss")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
