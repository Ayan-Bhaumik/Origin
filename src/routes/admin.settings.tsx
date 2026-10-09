import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/admin-api";
import { DEFAULT_SETTINGS, timerLabel, type AppSettings } from "@/lib/clip-rules";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [
    { title: "Settings — origin admin" },
    { name: "description", content: "Configure origin sharing limits, expiry and service settings." },
    { property: "og:title", content: "Settings — origin admin" },
    { property: "og:description", content: "Configure origin sharing limits, expiry and service settings." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: SettingsPage,
});

const ALL_TIMERS = DEFAULT_SETTINGS.allowed_timers;
const RETENTION = [
  { v: 86400, l: "24 hours" },
  { v: 604800, l: "7 days" },
  { v: 2592000, l: "30 days" },
];

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("key, value");
      const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
      for (const r of data ?? []) s[r.key] = r.value;
      return s as AppSettings;
    },
  });
  const [form, setForm] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (!form) return <div className="flex flex-col gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => setForm({ ...form, [k]: v });

  const save = async () => {
    if (!form.allowed_timers.length) {
      toast.error("Allow at least one timer.");
      return;
    }
    if (!form.allowed_timers.includes(form.default_timer_seconds)) {
      toast.error("The default timer must be one of the allowed timers.");
      return;
    }
    setSaving(true);
    const changed = (Object.keys(form) as (keyof AppSettings)[]).filter((k) => JSON.stringify(form[k]) !== JSON.stringify(data?.[k]));
    const now = new Date().toISOString();
    const { error } = await supabase.from("settings").upsert(changed.map((k) => ({ key: k, value: form[k] as never, updated_at: now })));
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (changed.length) await logAudit("settings_change", null, changed.join(", "));
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["admin", "settings"] });
  };

  const MB = 1048576;

  return (
    <div className="flex max-w-2xl flex-col gap-8 pb-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Section title="Timers">
        <div className="flex flex-col gap-1.5">
          <Label>Default timer</Label>
          <Select value={String(form.default_timer_seconds)} onValueChange={(v) => set("default_timer_seconds", Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{form.allowed_timers.slice().sort((a, b) => a - b).map((t) => <SelectItem key={t} value={String(t)}>{timerLabel(t)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Allowed timers</legend>
          <div className="flex flex-wrap gap-4">
            {ALL_TIMERS.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.allowed_timers.includes(t)} onCheckedChange={(v) => set("allowed_timers", v ? [...form.allowed_timers, t].sort((a, b) => a - b) : form.allowed_timers.filter((x) => x !== t))} />
                {timerLabel(t)}
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section title="Size limits">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField label="Max text (KB)" value={form.max_text_bytes / 1024} onChange={(v) => set("max_text_bytes", Math.round(v * 1024))} />
          <NumberField label="Max image (MB)" value={form.max_image_bytes / MB} onChange={(v) => set("max_image_bytes", Math.round(v * MB))} max={25} />
          <NumberField label="Max file (MB)" value={form.max_file_bytes / MB} onChange={(v) => set("max_file_bytes", Math.round(v * MB))} max={25} />
        </div>
        <p className="text-xs text-muted-foreground">Uploads are capped at 25 MB by storage.</p>
        <TagInput label="File MIME allowlist" hint="Leave empty to allow any type. Wildcards like application/* work." values={form.mime_allowlist} onChange={(v) => set("mime_allowlist", v)} placeholder="application/pdf" />
      </Section>

      <Section title="Metadata retention">
        <RadioGroup value={String(form.retention_seconds)} onValueChange={(v) => set("retention_seconds", Number(v))} className="flex flex-wrap gap-4">
          {RETENTION.map((r) => (
            <label key={r.v} className="flex items-center gap-2 text-sm"><RadioGroupItem value={String(r.v)} /> {r.l}</label>
          ))}
        </RadioGroup>
      </Section>

      <Section title="Blocked codes">
        <TagInput label="Codes nobody can claim" values={form.blocked_codes} onChange={(v) => set("blocked_codes", v.map((x) => x.toLowerCase()))} placeholder="Add a code" />
      </Section>

      <Section title="Site status">
        <label className="flex items-center justify-between gap-4 text-sm">
          <span><span className="font-medium">Maintenance mode</span><br /><span className="text-muted-foreground">Stops new clips from being sent.</span></span>
          <Switch checked={form.maintenance_mode} onCheckedChange={(v) => set("maintenance_mode", v)} />
        </label>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="banner">Announcement banner</Label>
          <Input id="banner" value={form.announcement_banner} maxLength={280} onChange={(e) => set("announcement_banner", e.target.value)} placeholder="Shown at the top of the site when not empty" />
        </div>
      </Section>

      <Button onClick={save} disabled={saving} className="self-start">{saving ? "Saving…" : "Save settings"}</Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface flex flex-col gap-4 p-5">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}

function NumberField({ label, value, onChange, max }: { label: string; value: number; onChange: (v: number) => void; max?: number }) {
  const id = label.replace(/\W/g, "");
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" min={1} max={max} step="any" value={Number(value.toFixed(2))} onChange={(e) => onChange(Math.max(0.01, Math.min(max ?? Infinity, Number(e.target.value) || 0)))} />
    </div>
  );
}

function TagInput({ label, hint, values, onChange, placeholder }: { label: string; hint?: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 font-mono text-xs">
            {v}
            <button aria-label={`Remove ${v}`} className="rounded hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onChange(values.filter((x) => x !== v))}><X className="size-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} placeholder={placeholder} aria-label={`Add to ${label}`} />
        <Button type="button" variant="outline" onClick={add}>Add</Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
