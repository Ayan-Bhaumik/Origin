import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfMonth, startOfWeek, subDays } from "date-fns";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — origin admin" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

const TYPE_COLORS: Record<string, string> = { text: "var(--chart-1)", image: "var(--chart-2)", file: "var(--chart-3)" };

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const since = subDays(startOfDay(new Date()), 29).toISOString();
      const { data, error } = await supabase
        .from("clips")
        .select("type, status, created_at, expires_at, file_size, view_count")
        .or(`created_at.gte.${since},status.eq.active`)
        .order("created_at", { ascending: false })
        .limit(10000);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  const now = new Date();
  const active = data.filter((c) => c.status === "active" && new Date(c.expires_at) > now);
  const after = (d: Date) => data.filter((c) => new Date(c.created_at) >= d).length;
  const stats = [
    { label: "Active clips", value: active.length },
    { label: "Created today", value: after(startOfDay(now)) },
    { label: "This week", value: after(startOfWeek(now)) },
    { label: "This month", value: after(startOfMonth(now)) },
    { label: "Storage used", value: `${(active.filter((c) => c.type !== "text").reduce((s, c) => s + (c.file_size ?? 0), 0) / 1048576).toFixed(1)} MB` },
    { label: "Total views", value: data.reduce((s, c) => s + c.view_count, 0) },
    { label: "Expiring < 1 hr", value: active.filter((c) => new Date(c.expires_at).getTime() - now.getTime() < 3600000).length },
  ];

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(startOfDay(now), 29 - i);
    const key = format(d, "yyyy-MM-dd");
    return { key, label: format(d, "MMM d"), clips: 0 };
  });
  for (const c of data) {
    const k = format(new Date(c.created_at), "yyyy-MM-dd");
    const day = days.find((d) => d.key === k);
    if (day) day.clips++;
  }
  const types = ["text", "image", "file"].map((t) => ({ name: t, value: data.filter((c) => c.type === t).length }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="surface p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface p-4 lg:col-span-2">
          <h2 className="text-sm font-medium">Clips created · last 30 days</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <LineChart data={days}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={30} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="clips" stroke="var(--primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="surface p-4">
          <h2 className="text-sm font-medium">Clip types</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={types} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {types.map((t) => <Cell key={t.name} fill={TYPE_COLORS[t.name]} />)}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
