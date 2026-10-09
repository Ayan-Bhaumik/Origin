import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Bell, Check, ChevronRight, Eye, Copy, FileIcon, ImageIcon, Link2, Trash2, Type, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { checkCodeAvailable, createClip, createUploadUrl, deleteOwnClip, getReceipt } from "@/lib/clips.functions";
import { RecentClips, forgetClip, rememberClip } from "@/components/recent-clips";
import { useOnline } from "@/hooks/use-online";
import { formatBytes, isSafeNotifyUrl, timerLabel, validateCustomCode, validatePin } from "@/lib/clip-rules";
import { useCountdown } from "@/hooks/use-countdown";
import { cn } from "@/lib/utils";

export type PublicSettings = {
  default_timer_seconds: number;
  allowed_timers: number[];
  max_text_bytes: number;
  max_image_bytes: number;
  max_file_bytes: number;
  blocked_codes: string[];
  mime_allowlist: string[];
  maintenance_mode: boolean;
  announcement_banner: string;
};

type Kind = "text" | "image" | "file";

const ERRORS: Record<string, string> = {
  rate_limited: "Too many requests. Please slow down.",
  blocked: "Sending is unavailable from your network.",
  maintenance: "origin is under maintenance. Please try again soon.",
  too_large: "That's over the size limit.",
  bad_type: "That file type isn't allowed.",
  taken: "That code is already taken.",
  empty: "Add some content first.",
  bad_timer: "Pick one of the available timers.",
};
const errMsg = (e: string) => ERRORS[e] ?? (e.length > 30 ? "Something went wrong. Please try again." : e);

const TOKENS_KEY = "origin-delete-tokens";
function saveToken(code: string, token: string) {
  const all = JSON.parse(localStorage.getItem(TOKENS_KEY) || "{}");
  all[code] = token;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(all));
}
function takeToken(code: string): string | null {
  const all = JSON.parse(localStorage.getItem(TOKENS_KEY) || "{}");
  return all[code] ?? null;
}
function dropToken(code: string) {
  const all = JSON.parse(localStorage.getItem(TOKENS_KEY) || "{}");
  delete all[code];
  localStorage.setItem(TOKENS_KEY, JSON.stringify(all));
}

export function SendPanel({ settings }: { settings: PublicSettings }) {
  const [kind, setKind] = useState<Kind>("text");
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [customCode, setCustomCode] = useState("");
  const [codeState, setCodeState] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [burn, setBurn] = useState(false);
  const [timer, setTimer] = useState(settings.default_timer_seconds);
  const [notify, setNotify] = useState(false);
  const [notifyUrl, setNotifyUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ code: string; expiresAt: string; notifyToken: string | null } | null>(null);
  const online = useOnline();

  const check = useServerFn(checkCodeAvailable);
  const create = useServerFn(createClip);
  const upload = useServerFn(createUploadUrl);

  const textBytes = new TextEncoder().encode(text).length;
  const timers = settings.allowed_timers.filter((t) => t <= 86400).sort((a, b) => a - b);

  useEffect(() => {
    if (!image) {
      setImageUrl(null);
      return;
    }
    const u = URL.createObjectURL(image);
    setImageUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [image]);

  // Debounced availability check
  useEffect(() => {
    const value = customCode.trim();
    if (!value) {
      setCodeState("idle");
      setCodeError(null);
      return undefined;
    }
    const local = validateCustomCode(value, settings.blocked_codes);
    if (local) {
      setCodeState("invalid");
      setCodeError(local);
      return undefined;
    }
    setCodeState("checking");
    const id = setTimeout(async () => {
      const r = await check({ data: { code: value } });
      if (r.error) {
        setCodeState("invalid");
        setCodeError(errMsg(r.error));
      } else {
        setCodeState(r.available ? "available" : "taken");
        setCodeError(null);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [customCode, settings.blocked_codes, check]);

  const acceptImage = (f: File) => {
    if (!f.type.startsWith("image/")) {
      toast.error("Only images can go here.");
    } else if (f.size > settings.max_image_bytes) {
      toast.error(`Images must be under ${formatBytes(settings.max_image_bytes)}.`);
    } else {
      setImage(f);
      setKind("image");
    }
  };
  const acceptFile = (f: File) => {
    if (f.size > settings.max_file_bytes) {
      toast.error(`Files must be under ${formatBytes(settings.max_file_bytes)}.`);
    } else {
      setFile(f);
      setKind("file");
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData.items);
    const img = items.find((i) => i.type.startsWith("image/"))?.getAsFile();
    if (img) {
      e.preventDefault();
      acceptImage(img);
      return;
    }
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
    const t = e.clipboardData.getData("text");
    if (t) {
      e.preventDefault();
      setKind("text");
      setText((prev) => prev + t);
    }
  };

  const notifyUrlBad = notify && !!notifyUrl.trim() && !isSafeNotifyUrl(notifyUrl.trim());
  const canSend =
    online &&
    !notifyUrlBad &&
    !settings.maintenance_mode &&
    !sending &&
    codeState !== "taken" &&
    codeState !== "invalid" &&
    codeState !== "checking" &&
    (!pin || !validatePin(pin)) &&
    ((kind === "text" && text.trim().length > 0 && textBytes <= settings.max_text_bytes) ||
      (kind === "image" && !!image) ||
      (kind === "file" && !!file));

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      let filePath: string | undefined;
      let fileName: string | undefined;
      let fileMime: string | undefined;
      const f = kind === "image" ? image : kind === "file" ? file : null;
      if (f) {
        const u = await upload({
          data: { kind: kind as "image" | "file", fileName: f.name || "pasted.png", size: f.size, mime: f.type || "application/octet-stream" },
        });
        if (!u.ok) throw new Error(u.error);
        const { error } = await supabase.storage.from("clips-files").uploadToSignedUrl(u.path, u.token, f, {
          contentType: f.type || "application/octet-stream",
        });
        if (error) throw new Error("Upload failed. Please try again.");
        filePath = u.path;
        fileName = f.name || "pasted.png";
        fileMime = f.type || "application/octet-stream";
      }
      const r = await create({
        data: {
          type: kind,
          content: kind === "text" ? text : undefined,
          filePath,
          fileName,
          fileMime,
          customCode: customCode.trim() || undefined,
          pin: pin || undefined,
          burnAfterRead: burn,
          timerSeconds: timer,
          notify,
          notifyUrl: notify && notifyUrl.trim() ? notifyUrl.trim() : undefined,
        },
      });
      if (!r.ok) throw new Error(r.error);
      saveToken(r.code, r.deleteToken);
      rememberClip({ code: r.code, type: kind, expiresAt: r.expiresAt, createdAt: new Date().toISOString() });
      setResult({ code: r.code, expiresAt: r.expiresAt, notifyToken: r.notifyToken });
      toast.success("Clip ready to share");
    } catch (e) {
      toast.error(errMsg((e as Error).message));
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setResult(null);
    setText("");
    setImage(null);
    setFile(null);
    setCustomCode("");
    setPin("");
    setBurn(false);
    setNotify(false);
    setNotifyUrl("");
    setTimer(settings.default_timer_seconds);
    setKind("text");
  };

  // Keyboard: Cmd/Ctrl+Enter sends, Escape clears the form (when no dialog is open).
  const sendRef = useRef(send);
  sendRef.current = send;
  const resetRef = useRef(reset);
  resetRef.current = reset;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !result) {
        const t = e.target as HTMLElement | null;
        if (t?.closest("#retrieve-form")) return;
        e.preventDefault();
        sendRef.current();
      } else if (e.key === "Escape" && !document.querySelector("[role=dialog],[role=alertdialog]")) {
        const t = e.target as HTMLElement | null;
        if (t?.closest("#retrieve-form")) return;
        resetRef.current();
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result]);

  if (result)
    return (
      <div className="flex flex-col gap-5">
        <SendSuccess code={result.code} expiresAt={result.expiresAt} notifyToken={result.notifyToken} onReset={reset} />
        <RecentClips />
      </div>
    );

  return (
    <div onPaste={onPaste} className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Send</h2>
        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <TabsList aria-label="Content type">
            <TabsTrigger value="text"><Type className="size-3.5" /> Text</TabsTrigger>
            <TabsTrigger value="image"><ImageIcon className="size-3.5" /> Image</TabsTrigger>
            <TabsTrigger value="file"><FileIcon className="size-3.5" /> File</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {kind === "text" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="send-text" className="sr-only">Text to send</Label>
          <Textarea
            id="send-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste or type anything…"
            className="min-h-44 resize-y font-mono text-sm"
          />
          <p className={cn("text-right text-xs tabular-nums", textBytes > settings.max_text_bytes ? "text-destructive" : "text-muted-foreground")}>
            {text.length.toLocaleString()} chars · {formatBytes(textBytes)} / {formatBytes(settings.max_text_bytes)}
          </p>
        </div>
      )}

      {kind === "image" &&
        (image && imageUrl ? (
          <div className="relative overflow-hidden rounded-lg border bg-muted">
            <img src={imageUrl} alt="Selected preview" className="mx-auto max-h-56 object-contain" />
            <Button variant="secondary" size="icon" className="absolute right-2 top-2" onClick={() => setImage(null)} aria-label="Remove image">
              <X />
            </Button>
            <p className="border-t bg-card px-3 py-2 text-xs text-muted-foreground">{image.name || "Pasted image"} · {formatBytes(image.size)}</p>
          </div>
        ) : (
          <DropZone accept="image/*" hint={`PNG, JPG, GIF, WebP · up to ${formatBytes(settings.max_image_bytes)} · or paste`} onFile={acceptImage} />
        ))}

      {kind === "file" &&
        (file ? (
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground"><FileIcon className="size-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setFile(null)} aria-label="Remove file"><X /></Button>
          </div>
        ) : (
          <DropZone hint={`Any file · up to ${formatBytes(settings.max_file_bytes)}`} onFile={acceptFile} />
        ))}

      <Collapsible>
        <CollapsibleTrigger className="group flex items-center gap-1 rounded text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Options <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 flex flex-col gap-4 rounded-lg border p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="custom-code">Custom code</Label>
            <div className="relative">
              <Input
                id="custom-code"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.replace(/\s/g, ""))}
                maxLength={20}
                placeholder="Leave empty to auto-generate"
                className="pr-24 font-mono uppercase"
                aria-describedby="custom-code-status"
              />
              <span id="custom-code-status" aria-live="polite" className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium", codeState === "available" ? "text-success" : codeState === "checking" ? "text-muted-foreground" : "text-destructive")}>
                {codeState === "checking" && "Checking…"}
                {codeState === "available" && "available ✓"}
                {codeState === "taken" && "taken ✗"}
              </span>
            </div>
            {codeError && <p className="text-xs text-destructive">{codeError}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pin">Protect with PIN</Label>
            <Input
              id="pin"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="4–8 digits"
              className="font-mono tracking-widest"
            />
            <p className="text-xs text-muted-foreground">Recipient will need this PIN to view the content.</p>
            {pin && validatePin(pin) && <p className="text-xs text-destructive">{validatePin(pin)}</p>}
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="burn">Delete after first view</Label>
            <Switch id="burn" checked={burn} onCheckedChange={setBurn} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="notify">Notify me when viewed</Label>
              <Switch id="notify" checked={notify} onCheckedChange={setNotify} />
            </div>
            {notify && (
              <>
                <Input
                  id="notify-url"
                  type="url"
                  inputMode="url"
                  value={notifyUrl}
                  onChange={(e) => setNotifyUrl(e.target.value)}
                  placeholder="https://your-webhook.com/ping (optional)"
                  aria-label="Ping URL"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">We'll send one GET request to this URL on first view. Leave empty to get a status link instead.</p>
                {notifyUrlBad && <p className="text-xs text-destructive">Use a public https:// address.</p>}
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div role="radiogroup" aria-label="Expires after" className="flex flex-wrap gap-2">
        {timers.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={timer === t}
            onClick={() => setTimer(t)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
              timer === t ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {timerLabel(t)}
            {t === settings.default_timer_seconds && " · Auto"}
          </button>
        ))}
      </div>

      <Button size="lg" className="h-12 w-full text-base active:scale-[0.99]" disabled={!canSend} onClick={send}>
        {!online ? "You're offline" : settings.maintenance_mode ? "Sending paused for maintenance" : sending ? "Sending…" : "Send"}
      </Button>

      <RecentClips />
    </div>
  );
}

function DropZone({ accept, hint, onFile }: { accept?: string; hint: string; onFile: (f: File) => void }) {
  const [active, setActive] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setActive(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };
  return (
    <button
      type="button"
      data-active={active}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setActive(true);
      }}
      onDragLeave={() => setActive(false)}
      onDrop={onDrop}
      className="dropzone flex min-h-44 w-full flex-col items-center justify-center gap-2 p-6 text-center hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Upload className="size-6 text-muted-foreground" />
      <span className="text-sm font-medium">Drop here or choose from device</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}

function SendSuccess({ code, expiresAt, notifyToken, onReset }: { code: string; expiresAt: string; notifyToken: string | null; onReset: () => void }) {
  const { label, expired } = useCountdown(expiresAt);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const del = useServerFn(deleteOwnClip);
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/r/${code}`;

  const copy = async (value: string, what: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${what} copied`);
  };

  const remove = async () => {
    const token = takeToken(code);
    if (!token) {
      toast.error("This device can't delete that clip.");
      return;
    }
    setDeleting(true);
    const r = await del({ data: { code, token } });
    setDeleting(false);
    if (r.ok) {
      dropToken(code);
      forgetClip(code);
      setDeleted(true);
      toast.success("Clip deleted");
    } else toast.error(errMsg(r.error ?? "not_found"));
  };

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <p className="text-sm text-muted-foreground">{deleted ? "Clip deleted" : "Your code"}</p>
      <p className={cn("break-all font-mono text-5xl font-bold tracking-[0.15em] sm:text-6xl", deleted && "text-muted-foreground line-through")} aria-label={`Code ${code.split("").join(" ")}`}>
        {code}
      </p>
      {!deleted && (
        <>
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => copy(code, "Code")}><Copy /> Copy Code</Button>
            <Button variant="outline" onClick={() => copy(link, "Link")}><Link2 /> Copy Link</Button>
          </div>
          <div className="rounded-xl border bg-card p-3">
            <QRCodeSVG value={link} size={148} bgColor="transparent" fgColor="currentColor" className="text-foreground" aria-label="QR code for the retrieval link" />
          </div>
          <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">{expired ? "Expired" : label}</p>
          {notifyToken && <Receipt token={notifyToken} />}
        </>
      )}
      <div className="grid w-full grid-cols-2 gap-2">
        {!deleted && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={deleting}>
                <Trash2 /> {deleting ? "Deleting…" : "Delete now"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this clip?</AlertDialogTitle>
                <AlertDialogDescription>Nobody will be able to retrieve it after this.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <Button className={cn(deleted && "col-span-2")} onClick={onReset}><Check /> Send another</Button>
      </div>
    </div>
  );
}

function Receipt({ token }: { token: string }) {
  const [viewedAt, setViewedAt] = useState<string | null>(null);
  const poll = useServerFn(getReceipt);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/api/public/notify/${token}`;
  useEffect(() => {
    if (viewedAt) return undefined;
    let stop = false;
    const tick = async () => {
      try {
        const r = await poll({ data: { token } });
        if (!stop && r.viewedAt) setViewedAt(r.viewedAt);
      } catch {
        // ignore; try again next tick
      }
    };
    const id = setInterval(tick, 10000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [token, viewedAt, poll]);
  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border p-3 text-left">
      <p className="flex items-center gap-1.5 text-sm font-medium" aria-live="polite">
        {viewedAt ? <><Eye className="size-4 text-success" /> Viewed {new Date(viewedAt).toLocaleTimeString()}</> : <><Bell className="size-4 text-muted-foreground" /> Not viewed yet</>}
      </p>
      <p className="text-xs text-muted-foreground">Status link — only shown once, copy it now:</p>
      <div className="flex gap-2">
        <Input readOnly value={url} aria-label="Read receipt status link" className="h-9 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button variant="outline" size="icon" className="size-9 shrink-0" aria-label="Copy status link" onClick={async () => { await navigator.clipboard.writeText(url); toast.success("Status link copied"); }}><Copy /></Button>
      </div>
    </div>
  );
}
