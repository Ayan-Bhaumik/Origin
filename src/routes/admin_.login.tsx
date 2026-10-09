import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { adminExists, bootstrapAdmin } from "@/lib/clips.functions";
import { isCurrentUserAdmin } from "@/lib/admin-api";

export const Route = createFileRoute("/admin_/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin sign in — origin" },
      { name: "description", content: "Sign in to the origin admin panel." },
      { property: "og:title", content: "Admin sign in — origin" },
      { property: "og:description", content: "Sign in to the origin admin panel." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<boolean | null>(null);
  const exists = useServerFn(adminExists);
  const bootstrap = useServerFn(bootstrapAdmin);

  useEffect(() => {
    exists().then((r) => setSetup(!r.exists));
    isCurrentUserAdmin().then((ok) => {
      if (ok) navigate({ to: "/admin/dashboard" });
    });
  }, [exists, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (setup) {
        const r = await bootstrap({ data: { email, password } });
        if (!r.ok) throw new Error(r.error ?? "Could not create account.");
        toast.success("Admin account created");
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("Incorrect email or password.");
      if (!(await isCurrentUserAdmin())) {
        await supabase.auth.signOut();
        throw new Error("This account doesn't have admin access.");
      }
      navigate({ to: "/admin/dashboard" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-5 py-5">
        <a href="/" className="font-mono text-xl font-bold">origin<span className="text-primary">.</span></a>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-20">
        <form onSubmit={submit} className="surface flex w-full max-w-sm flex-col gap-4 p-6 shadow-sm">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{setup ? "Create admin account" : "Admin sign in"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {setup ? "No admin exists yet. The first account created here becomes the admin." : "Restricted area."}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete={setup ? "new-password" : "current-password"} required minLength={setup ? 10 : 1} value={password} onChange={(e) => setPassword(e.target.value)} />
            {setup && <p className="text-xs text-muted-foreground">At least 10 characters.</p>}
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy || setup === null}>
            {busy ? (setup ? "Creating…" : "Signing in…") : setup ? "Create and sign in" : "Sign in"}
          </Button>
        </form>
      </main>
    </div>
  );
}
