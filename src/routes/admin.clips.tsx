import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { ArrowUpDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton } from "@/components/confirm-button";
import { supabase } from "@/integrations/supabase/client";
import { adminDeleteClip, adminForceExpire, logAudit, type Clip } from "@/lib/admin-api";
import { formatBytes, maxExtendedExpiry, normalizeCode, validateCustomCode } from "@/lib/clip-rules";

export const Route = createFileRoute("/admin/clips")({
  head: () => ({ meta: [
    { title: "Clips — origin admin" },
    { name: "description", content: "Manage shared text, images and files in origin." },
    { property: "og:title", content: "Clips — origin admin" },
    { property: "og:description", content: "Manage shared text, images and files in origin." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  validateSearch: (s: Record<string, unknown>) => ({ code: typeof s["code"] === "string" ? (s["code"] as string) : undefined }),
  component: ClipsPage,
});

const PAGE = 25;
type SortKey = "code" | "type" | "status" | "view_count" | "created_at" | "expires_at" | "file_size";

function ClipsPage() {
  const { code: initialCode } = Route.useSearch();
  const qc = useQueryClient();
  const [search, setSearch] = useState(initialCode ?? "");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [pin, setPin] = useState("all");
  const [burn, setBurn] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "created_at", asc: false });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => setPage(0), [search, status, type, pin, burn, sort]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "clips", search, status, type, pin, burn, sort, page],
    queryFn: async () => {
      let q = supabase.from("clips").select("*", { count: "exact" });
      if (search.trim()) q = q.ilike("code", `%${normalizeCode(search)}%`);
      if (status !== "all") q = q.eq("status", status);
      if (type !== "all") q = q.eq("type", type);
      if (pin !== "all") q = q.eq("pin_protected", pin === "yes");
      if (burn !== "all") q = q.eq("burn_after_read", burn === "yes");
      const { data, count, error } = await q.order(sort.key, { ascending: sort.asc }).range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });

  useEffect(() => {
    if (initialCode && data?.rows.length === 1) setOpenId(data.rows[0]!.id);
  }, [initialCode, data]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const rows = data?.rows ?? [];
  const pages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE));
  const openClip = rows.find((r) => r.id === openId) ?? null;

  const bulkDelete = async () => {
    const targets = rows.filter((r) => selected.has(r.id));
    for (const c of targets) await adminDeleteClip(c);
    setSelected(new Set());
    toast.success(`Deleted ${targets.length} clip${targets.length === 1 ? "" : "s"}`);
    refresh();
  };

  const SortHead = ({ k, children }: { k: SortKey; children: string }) => (
    <TableHead>
      <button className="inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSort((s) => ({ key: k, asc: s.key === k ? !s.asc : false }))}>
        {children} <ArrowUpDown className="size-3" />
      </button>
    </TableHead>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Clips</h1>
        {selected.size > 0 && (
          <ConfirmButton title={`Delete ${selected.size} clips?`} description="Their content will be erased permanently." onConfirm={bulkDelete} variant="destructive" size="sm">
            Delete selected ({selected.size})
          </ConfirmButton>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input aria-label="Search by code" placeholder="Search code…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full font-mono uppercase sm:w-48" />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={["all", "active", "expired", "deleted"]} />
        <FilterSelect label="Type" value={type} onChange={setType} options={["all", "text", "image", "file"]} />
        <FilterSelect label="PIN" value={pin} onChange={setPin} options={["all", "yes", "no"]} />
        <FilterSelect label="Burn" value={burn} onChange={setBurn} options={["all", "yes", "no"]} />
      </div>

      <div className="surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox aria-label="Select all on page" checked={rows.length > 0 && rows.every((r) => selected.has(r.id))} onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())} />
              </TableHead>
              <SortHead k="code">Code</SortHead>
              <SortHead k="type">Type</SortHead>
              <SortHead k="status">Status</SortHead>
              <TableHead>PIN</TableHead>
              <TableHead>Burn</TableHead>
              <SortHead k="view_count">Views</SortHead>
              <SortHead k="created_at">Created</SortHead>
              <SortHead k="expires_at">Expires/Expired</SortHead>
              <SortHead k="file_size">Size</SortHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={10}><Skeleton className="h-5" /></TableCell></TableRow>
              ))}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">No clips match these filters.</TableCell></TableRow>
            )}
            {rows.map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpenId(c.id)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox aria-label={`Select ${c.code}`} checked={selected.has(c.id)} onCheckedChange={(v) => setSelected((s) => { const n = new Set(s); v ? n.add(c.id) : n.delete(c.id); return n; })} />
                </TableCell>
                <TableCell className="font-mono font-semibold uppercase">{c.code}</TableCell>
                <TableCell className="capitalize">{c.type}</TableCell>
                <TableCell><StatusBadge status={c.status} /></TableCell>
                <TableCell>{c.pin_protected ? "Yes" : "—"}</TableCell>
                <TableCell>{c.burn_after_read ? "Yes" : "—"}</TableCell>
                <TableCell className="tabular-nums">{c.view_count}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{format(new Date(c.created_at), "MMM d, HH:mm")}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{format(new Date(c.expired_at ?? c.expires_at), "MMM d, HH:mm")}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{c.file_size != null ? formatBytes(c.file_size) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data?.count ?? 0} clips</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="tabular-nums">{page + 1} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <Sheet open={!!openClip} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {openClip && <ClipDetail clip={openClip} onChanged={refresh} onClose={() => setOpenId(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-[calc(50%-4px)] capitalize sm:w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="capitalize">{o === "all" ? `${label}: all` : `${label}: ${o}`}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={status === "active" ? "default" : status === "deleted" ? "destructive" : "secondary"} className="capitalize">{status}</Badge>;
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ClipDetail({ clip, onChanged, onClose }: { clip: Clip; onChanged: () => void; onClose: () => void }) {
  const [urls, setUrls] = useState<{ name: string; url: string | null; size: number }[] | null>(null);
  const [newCode, setNewCode] = useState(clip.code.toUpperCase());
  const maxExp = maxExtendedExpiry(new Date(clip.created_at));
  const [newExpiry, setNewExpiry] = useState(toLocalInput(maxExp));
  const active = clip.status === "active";

  useEffect(() => {
    setUrls(null);
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("clip_files")
        .select("name, path, size")
        .eq("clip_id", clip.id)
        .order("position");
      const list = rows?.length
        ? rows
        : clip.file_path
          ? [{ name: clip.file_name ?? "file", path: clip.file_path, size: clip.file_size ?? 0 }]
          : [];
      const signed = await Promise.all(
        list.map(async (r) => {
          const { data } = await supabase.storage.from("clips-files").createSignedUrl(r.path, 300);
          return { name: r.name ?? "file", url: data?.signedUrl ?? null, size: r.size ?? 0 };
        }),
      );
      if (!cancelled) setUrls(signed);
    })();
    return () => {
      cancelled = true;
    };
  }, [clip.id, clip.file_path, clip.file_name, clip.file_size]);

  const act = async (fn: () => Promise<void>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message || "Action failed");
    }
  };

  const extend = () =>
    act(async () => {
      const d = new Date(newExpiry);
      if (isNaN(d.getTime()) || d <= new Date()) throw new Error("Pick a time in the future.");
      if (d > maxExp) throw new Error("Max 24 hours from creation.");
      const { error } = await supabase.from("clips").update({ expires_at: d.toISOString() }).eq("id", clip.id);
      if (error) throw error;
      await logAudit("extend", clip.code, `expires_at → ${d.toISOString()}`);
    }, "Expiry updated");

  const removePin = () =>
    act(async () => {
      const { error } = await supabase.from("clips").update({ pin_hash: null, pin_protected: false, failed_pin_attempts: 0, locked_until: null }).eq("id", clip.id);
      if (error) throw error;
      await logAudit("remove_pin", clip.code);
    }, "PIN removed");

  const changeCode = () =>
    act(async () => {
      const err = validateCustomCode(newCode, []);
      if (err) throw new Error(err);
      const next = normalizeCode(newCode);
      const { error } = await supabase.from("clips").update({ code: next }).eq("id", clip.id);
      if (error) throw new Error(error.code === "23505" ? "That code is already taken." : error.message);
      await logAudit("change_code", next, `from ${clip.code}`);
    }, "Code changed");

  const meta: [string, string][] = [
    ["Created", format(new Date(clip.created_at), "PPpp")],
    ["Expires", `${format(new Date(clip.expires_at), "PPpp")}${active ? ` (${formatDistanceToNowStrict(new Date(clip.expires_at), { addSuffix: true })})` : ""}`],
    ["Views", String(clip.view_count)],
    ["Last accessed", clip.last_accessed_at ? format(new Date(clip.last_accessed_at), "PPpp") : "Never"],
    ["Size", clip.file_size != null ? formatBytes(clip.file_size) : "—"],
    ["Type", clip.type],
    ["PIN protected", clip.pin_protected ? "Yes" : "No"],
    ["Burn after read", clip.burn_after_read ? "Yes" : "No"],
  ];

  return (
    <div className="flex flex-col gap-5">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 font-mono text-xl uppercase">{clip.code} <StatusBadge status={clip.status} /></SheetTitle>
        <SheetDescription>{clip.type === "text" ? "Text clip" : urls && urls.length > 1 ? `${urls.length} files` : (urls?.[0]?.name ?? clip.file_name ?? "File")}</SheetDescription>
      </SheetHeader>

      <section aria-label="Content">
        {clip.type === "text" && (clip.content != null ? <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted p-3 font-mono text-xs">{clip.content}</pre> : <p className="text-sm text-muted-foreground">Content erased.</p>)}
        {clip.type !== "text" &&
          (urls === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : urls.length === 0 ? (
            <p className="text-sm text-muted-foreground">File erased.</p>
          ) : urls.length === 1 ? (
            clip.type === "image" ? (
              urls[0].url ? (
                <img src={urls[0].url} alt={urls[0].name || "Clip image"} className="max-h-72 rounded-lg border object-contain" />
              ) : (
                <p className="text-sm text-muted-foreground">Couldn't load that file.</p>
              )
            ) : (
              urls[0].url && (
                <Button asChild variant="outline">
                  <a href={urls[0].url} download={urls[0].name || true}><Download /> Download {urls[0].name}</a>
                </Button>
              )
            )
          ) : (
            <ul className="flex max-h-72 flex-col gap-2 overflow-auto">
              {urls.map((f, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatBytes(f.size)}</span>
                  {f.url && (
                    <Button asChild variant="outline" size="sm">
                      <a href={f.url} download={f.name || true}><Download /> Save</a>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ))}
      </section>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {meta.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="capitalize-first">{v}</dd>
          </div>
        ))}
      </dl>

      {active && (
        <div className="flex flex-col gap-4 border-t pt-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="extend">Extend expiry (max {format(maxExp, "MMM d, HH:mm")})</Label>
            <div className="flex gap-2">
              <Input id="extend" type="datetime-local" value={newExpiry} max={toLocalInput(maxExp)} onChange={(e) => setNewExpiry(e.target.value)} />
              <Button variant="outline" onClick={extend}>Extend</Button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="change-code">Change code</Label>
            <div className="flex gap-2">
              <Input id="change-code" value={newCode} maxLength={20} onChange={(e) => setNewCode(e.target.value.toUpperCase())} className="font-mono" />
              <Button variant="outline" onClick={changeCode}>Save</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {clip.pin_protected && <ConfirmButton title="Remove PIN?" description="Anyone with the code will be able to open this clip." onConfirm={removePin} variant="outline">Remove PIN</ConfirmButton>}
            <ConfirmButton title="Force-expire this clip?" description="It will stop being retrievable and its content will be erased." onConfirm={() => act(() => adminForceExpire(clip), "Clip expired")} variant="outline">Force-expire</ConfirmButton>
            <ConfirmButton title="Delete this clip?" description="Its content will be erased permanently." onConfirm={() => act(async () => { await adminDeleteClip(clip); onClose(); }, "Clip deleted")} variant="destructive">Delete</ConfirmButton>
          </div>
        </div>
      )}
    </div>
  );
}
