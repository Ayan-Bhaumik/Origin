import { Link } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/theme-toggle";
import { SendPanel, type PublicSettings } from "@/components/send-panel";
import { RetrievePanel } from "@/components/retrieve-panel";

const STEPS = [
  { t: "Add your content", d: "Paste text, drop an image, or upload any file." },
  { t: "Get your code", d: "A short code is generated. Share it or scan the QR." },
  { t: "Retrieve anywhere", d: "Enter the code on any device to get your content." },
];

const FAQ = [
  { q: "Do I need an account?", a: "No. origin works without sign-up on any device with a browser." },
  { q: "How long does a clip last?", a: "You choose — from 10 minutes up to 24 hours. After that it's deleted automatically." },
  { q: "Can I protect a clip?", a: "Yes. Add a PIN in Options, or turn on “Delete after first view” so it disappears once opened." },
  { q: "What are the size limits?", a: "Text up to 100 KB, images up to 10 MB, and files up to 25 MB." },
];

export function Landing({ settings, initialCode }: { settings: PublicSettings; initialCode?: string | undefined }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[520px]" aria-hidden />
      {settings.announcement_banner && (
        <div role="status" className="relative flex items-center justify-center gap-2 border-b bg-accent px-4 py-2 text-center text-sm text-accent-foreground">
          <Megaphone className="size-4 shrink-0" /> {settings.announcement_banner}
        </div>
      )}
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="rounded font-mono text-xl font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          origin<span className="text-primary">.</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative mx-auto max-w-6xl px-5 pb-16">
        <section className="pb-10 pt-8 text-center sm:pt-14">
          <h1 className="mx-auto max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Move anything between your devices, instantly.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-balance text-muted-foreground">
            Text, images and files — no account, no app. Just a short code.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-2" aria-label="Send and retrieve">
          <div className="surface p-5 shadow-sm sm:p-6">
            <SendPanel settings={settings} />
          </div>
          <div className="surface p-5 shadow-sm sm:p-6 md:self-start">
            <RetrievePanel initialCode={initialCode} />
          </div>
        </section>

        <section className="mt-20" aria-labelledby="how">
          <h2 id="how" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">How it works</h2>
          <ol className="mt-6 grid gap-5 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.t} className="border-t pt-5">
                <span className="font-mono text-sm text-primary">0{i + 1}</span>
                <h3 className="mt-2 font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">About</h2>
            <p className="mt-6 text-pretty leading-relaxed">
              origin is a lightweight cross-device clipboard. Most clipboards only work on one device. origin gives you a
              secure, temporary channel to move text, images, and files between any devices — no account, no app, no friction.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">FAQ</h2>
            <Accordion type="single" collapsible className="mt-4">
              {FAQ.map((f) => (
                <AccordionItem key={f.q} value={f.q}>
                  <AccordionTrigger>{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono font-semibold text-foreground">origin</span>
          <p>Content is temporary and auto-deleted. The site owner can access stored content. Don't share sensitive information.</p>
          <Link
            to="/admin/login"
            className="shrink-0 rounded text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Admin
          </Link>
        </div>
      </footer>
    </div>
  );
}
