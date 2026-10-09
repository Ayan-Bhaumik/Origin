import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton } from "@/components/confirm-button";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/security")({
  head: () => ({ meta: [{ title: "Security — origin admin" }, { name: "robots", content: "noindex" }] }),
  component: SecurityPage,
});

function SecurityPage() {
  const qc = useQueryClient();
  const [ip, setIp] = useState("");
  const [note, setNote] = useState("");
  const rules = useQuery({
    queryKey: ["admin", "ip_rules"],
    queryFn: async () => (await supabase.from("ip_rules").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const log = useQuery({
    queryKey: ["admin", "rate_log"],
    queryFn: async () => (await supabase.from("rate_limit_log").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const value = ip.trim();
    if (!/^[0-9a-fA-F:.]{3,45}$/.test(value)) return toast.error("Enter a valid IP address.");
    const { error } = await supabase.from("ip_rules").insert({ ip: value, note: note.trim() || null });
    if (error) return toast.error(error.code === "23505" ? "That IP is already blocked." : error.message);
    await logAudit("ip_block", value, note.trim() || undefined);
    setIp("");
    setNote("");
    toast.success("IP blocked");
    qc.invalidateQueries({ queryKey: ["admin", "ip_rules"] });
  };
  const remove = async (id: string, value: string) => {
    await supabase.from("ip_rules").delete().eq("id", id);
    await logAudit("ip_unblock", value);
    toast.success("IP unblocked");
    qc.invalidateQueries({ queryKey: ["admin", "ip_rules"] });
  };

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">IP block list</h2>
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <Input aria-label="IP address" placeholder="203.0.113.7" value={ip} onChange={(e) => setIp(e.target.value)} className="w-full font-mono sm:w-52" />
          <Input aria-label="Note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="w-full sm:w-64" />
          <Button type="submit">Block IP</Button>
        </form>
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>IP</TableHead><TableHead>Note</TableHead><TableHead>Added</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rules.isLoading && <TableRow><TableCell colSpan={4}><Skeleton className="h-5" /></TableCell></TableRow>}
              {!rules.isLoading && !rules.data?.length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No blocked IPs.</TableCell></TableRow>}
              {rules.data?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.ip}</TableCell>
                  <TableCell>{r.note ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                  <TableCell className="text-right">
                    <ConfirmButton title="Unblock this IP?" description={`${r.ip} will be able to use origin again.`} onConfirm={() => remove(r.id, r.ip)} variant="ghost" size="sm">Remove</ConfirmButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Recent rate-limited requests</h2>
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>IP</TableHead><TableHead>Action</TableHead><TableHead>When</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {log.isLoading && <TableRow><TableCell colSpan={4}><Skeleton className="h-5" /></TableCell></TableRow>}
              {!log.isLoading && !log.data?.length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No rate-limited requests.</TableCell></TableRow>}
              {log.data?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.ip}</TableCell>
                  <TableCell className="capitalize">{r.action}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(r.created_at), "MMM d, HH:mm:ss")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setIp(r.ip)}>Block…</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
