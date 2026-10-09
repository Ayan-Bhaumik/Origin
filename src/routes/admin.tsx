import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { BarChart3, Files, Flag, LogOut, ScrollText, Settings, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { isCurrentUserAdmin } from "@/lib/admin-api";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    if (!(await isCurrentUserAdmin())) throw redirect({ to: "/admin/login" });
  },
  head: () => ({
    meta: [
      { title: "Admin — origin" },
      { name: "description", content: "origin admin panel." },
      { property: "og:title", content: "Admin — origin" },
      { property: "og:description", content: "origin admin panel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/admin/clips", label: "Clips", icon: Files },
  { to: "/admin/reports", label: "Reports", icon: Flag },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/security", label: "Security", icon: Shield },
  { to: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
] as const;

function AdminLayout() {
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  };
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b bg-sidebar md:sticky md:top-0 md:flex md:h-screen md:w-56 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-4">
          <Link to="/" className="font-mono text-lg font-bold">origin<span className="text-primary">.</span> <span className="text-xs font-medium text-muted-foreground">admin</span></Link>
          <div className="md:hidden"><ThemeToggle /></div>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:overflow-visible">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              activeProps={{ className: "bg-sidebar-accent !text-foreground font-medium" }}
            >
              <n.icon className="size-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center justify-between border-t px-3 py-3 md:flex">
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut /> Sign out</Button>
          <ThemeToggle />
        </div>
        <div className="px-2 pb-2 md:hidden">
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut /> Sign out</Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}
