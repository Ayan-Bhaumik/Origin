import { useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Download, FileIcon, Flag, Flame, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { reportClip, retrieveClip, type RetrieveResult } from "@/lib/clips.functions";
import { formatBytes, looksLikeMarkdown } from "@/lib/clip-rules";
import { useOnline } from "@/hooks/use-online";
import { MarkdownView } from "@/components/markdown-view";
import { cn } from "@/lib/utils";
import { useCountdown } from "@/hooks/use-countdown";

type Ok = Extract<RetrieveResult, { status: "ok" }>;

const MESSAGES: Record<string, string> = {
  not_found: "This clip doesn't exist or has expired.",
  locked: "Too many attempts. Try again in 15 minutes.",
  rate_limited: "Too many requests. Please slow down.",
  burned: "This clip has already been viewed and deleted.",
  blocked: "Retrieval is unavailable from your network.",
};

export function RetrievePanel({ initialCode }: { initialCode?: string | undefined }) {
  const [code, setCode] = useState(initialCode?.toUpperCase() ?? "");
  const [pin, setPin] = useState("");
  const [needPin, setNeedPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clip, setClip] = useState<Ok | null>(null);
  const retrieve = useServerFn(retrieveClip);
  const auto = useRef(false);
  const online = useOnline();
  const codeRef = useRef<HTMLInputElement>(null);

  // "/" focuses the code box when not typing elsewhere; Escape in the form clears it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !document.querySelector("[role=dialog],[role=alertdialog]")) {
        e.preventDefault();
        codeRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = async (withPin?: string) => {
    const c = code.trim();
    if (!c) return;
    if (!navigator.onLine) {
      setError("You're offline. Connect to the internet to retrieve clips.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await retrieve({ data: { code: c, pin: withPin || undefined } });
      if (r.status === "ok") {
        setClip(r);
        setNeedPin(false);
      } else if (r.status === "pin_required") {
        setNeedPin(true);
      } else if (r.status === "wrong_pin") {
        setError(`Incorrect PIN. ${r.remaining} attempt${r.remaining === 1 ? "" : "s"} remaining.`);
        setPin("");
      } else {
        setError(MESSAGES[r.status] ?? "Something went wrong.");
        if (r.status === "locked") setPin("");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode && !auto.current) {
      auto.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(needPin ? pin : undefined);
  };

  const reset = () => {
    setClip(null);
    setCode("");
    setPin("");
    setNeedPin(false);
    setError(null);
  };

  if (clip) return <ClipView clip={clip} onReset={reset} />;

  return (
    <form id="retrieve-form" onSubmit={submit} onKeyDown={(e) => { if (e.key === "Escape") { setCode(""); setPin(""); setNeedPin(false); setError(null); (e.target as HTMLElement).blur(); } }} className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold tracking-tight">Retrieve</h2>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="retrieve-code" className="text-muted-foreground">Enter code</Label>
        <Input
          id="retrieve-code"
          ref={codeRef}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().replace(/\s/g, ""));
            setNeedPin(false);
            setError(null);
          }}
          onPaste={(e) => {
            e.preventDefault();
            setCode(e.clipboardData.getData("text").trim().toUpperCase().replace(/\s/g, "").slice(0, 20));
          }}
          maxLength={20}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABC234"
          className="h-16 text-center font-mono text-3xl font-bold tracking-[0.2em] placeholder:text-muted-foreground/40 md:text-3xl"
        />
      </div>

      {needPin && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="retrieve-pin" className="flex items-center gap-1.5"><Lock className="size-3.5" /> This clip is PIN protected</Label>
          <Input
            id="retrieve-pin"
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter PIN"
            className="h-12 text-center font-mono text-xl tracking-[0.3em]"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>
      )}

      {loading && !error && (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      <Button type="submit" size="lg" variant={needPin ? "default" : "outline"} className="h-12 w-full text-base active:scale-[0.99]" disabled={!online || loading || !code.trim() || (needPin && pin.length < 4)}>
        {!online ? "You're offline" : loading ? "Retrieving…" : needPin ? "Unlock" : "Retrieve"}
      </Button>
    </form>
  );
}

function ClipView({ clip, onReset }: { clip: Ok; onReset: () => void }) {
  const { label, expired } = useCountdown(clip.expiresAt);
  const isMd = clip.type === "text" && looksLikeMarkdown(clip.content ?? "");
  const [mode, setMode] = useState<"raw" | "preview">(isMd ? "preview" : "raw");
  const first = clip.files[0] ?? null;
  const copyText = async () => {
    await navigator.clipboard.writeText(clip.content ?? "");
    toast.success("Copied to clipboard");
  };
  const copyImage = async () => {
    try {
      const blob = await (await fetch(first!.url!)).blob();
      const png = blob.type === "image/png" ? blob : await toPng(blob);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      toast.success("Image copied");
    } catch {
      toast.error("Couldn't copy the image. Try downloading it instead.");
    }
  };
  const download = async (f: { url: string | null; name: string }) => {
    if (!f.url) return;
    try {
      const blob = await (await fetch(f.url)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = f.name || "download";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Download link expired. Retrieve the clip again.");
    }
  };
  const downloadAll = async () => {
    for (const f of clip.files) {
      await download(f);
      await new Promise((r) => setTimeout(r, 400));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-mono text-lg font-bold tracking-widest">{clip.code}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">{clip.burned ? "Deleted after this view" : expired ? "Expired" : label}</span>
      </div>
      {clip.burned && (
        <p className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
          <Flame className="size-3.5" /> This clip has now been deleted. Save what you need.
        </p>
      )}

      {clip.type === "text" && (
        <>
          {isMd && (
            <div role="tablist" aria-label="Text view" className="inline-flex self-start rounded-md border bg-muted p-0.5 text-xs">
              {(["raw", "preview"] as const).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("rounded px-3 py-1 font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {m}
                </button>
              ))}
            </div>
          )}
          {isMd && mode === "preview" ? (
            <MarkdownView content={clip.content ?? ""} />
          ) : (
            <Textarea readOnly value={clip.content ?? ""} aria-label="Clip text" className="min-h-44 font-mono text-sm" />
          )}
          <Button onClick={copyText}><Copy /> Copy</Button>
        </>
      )}

      {clip.type === "image" && first && (
        clip.files.length === 1 ? (
          <>
            <div className="overflow-hidden rounded-lg border bg-muted">
              <img src={first.url ?? ""} alt={first.name || "Shared image"} className="mx-auto max-h-80 object-contain" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => download(first)}><Download /> Download</Button>
              <Button onClick={copyImage}><Copy /> Copy Image</Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {clip.files.map((f, i) => (
                <figure key={i} className="overflow-hidden rounded-lg border bg-muted">
                  {f.url && <img src={f.url} alt={f.name || "Shared image"} loading="lazy" className="h-40 w-full object-cover" />}
                  <figcaption className="flex items-center justify-between gap-2 border-t bg-card px-2.5 py-1.5 text-xs">
                    <span className="truncate text-muted-foreground" title={f.name}>{f.name || `Image ${i + 1}`}</span>
                    {f.url && (
                      <a href={f.url} download={f.name || true} className="shrink-0 font-medium underline-offset-4 hover:underline">
                        Save
                      </a>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
            <Button variant="outline" onClick={downloadAll} disabled={clip.files.some((f) => !f.url)}>
              <Download /> Download all ({clip.files.length})
            </Button>
          </>
        )
      )}

      {clip.type === "file" && first && (
        clip.files.length === 1 ? (
          <>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground"><FileIcon className="size-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{first.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(first.size)}</p>
              </div>
            </div>
            <Button onClick={() => download(first)}><Download /> Download</Button>
          </>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {clip.files.map((f, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground"><FileIcon className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
                  </div>
                  {f.url && (
                    <Button asChild variant="outline" size="sm">
                      <a href={f.url} download={f.name || true}><Download /> Save</a>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <Button variant="outline" onClick={downloadAll} disabled={clip.files.some((f) => !f.url)}>
              <Download /> Download all ({clip.files.length})
            </Button>
          </>
        )
      )}

      <div className="flex items-center justify-between pt-1">
        <ReportLink code={clip.code} />
        <Button variant="ghost" size="sm" onClick={onReset}>Retrieve another</Button>
      </div>
    </div>
  );
}

async function toPng(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej()), "image/png"));
}

function ReportLink({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const report = useServerFn(reportClip);
  const submit = async () => {
    setSending(true);
    const r = await report({ data: { code, reason } });
    setSending(false);
    if (r.ok) {
      toast.success("Thanks — we'll take a look.");
      setOpen(false);
      setReason("");
    } else toast.error(r.error === "rate_limited" ? "Too many requests. Please slow down." : "Couldn't send the report.");
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 rounded text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Flag className="size-3" /> Report this clip
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this clip</DialogTitle>
          <DialogDescription>Tell us what's wrong with clip {code}.</DialogDescription>
        </DialogHeader>
        <Label htmlFor="report-reason" className="sr-only">Reason</Label>
        <Textarea id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="e.g. spam, malware, abusive content" />
        <DialogFooter>
          <Button onClick={submit} disabled={sending || !reason.trim()}>{sending ? "Sending…" : "Send report"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
