import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileIcon, ImageIcon, Link2, Type, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addToHistory, pruneHistory, type HistoryItem } from "@/lib/clip-rules";
import { useCountdown } from "@/hooks/use-countdown";

const KEY = "origin-history";
const EVT = "origin-history-change";

function read(): HistoryItem[] {
  try {
    return pruneHistory(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {
    return [];
  }
}
function write(list: HistoryItem[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
}
export function rememberClip(item: HistoryItem) {
  write(addToHistory(read(), item));
}
export function forgetClip(code: string) {
  write(read().filter((i) => i.code !== code));
}

const ICONS = { text: Type, image: ImageIcon, file: FileIcon };

export function RecentClips() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  useEffect(() => {
    const sync = () => setItems(read());
    sync();
    const id = setInterval(sync, 15000);
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      clearInterval(id);
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  if (!items.length) return null;
  return (
    <section aria-labelledby="recent" className="flex flex-col gap-2 border-t pt-4">
      <h3 id="recent" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent</h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((i) => <Row key={i.code} item={i} />)}
      </ul>
    </section>
  );
}

function Row({ item }: { item: HistoryItem }) {
  const { label, expired } = useCountdown(item.expiresAt);
  useEffect(() => {
    if (expired) forgetClip(item.code);
  }, [expired, item.code]);
  const Icon = ICONS[item.type];
  const copy = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/r/${item.code}`);
    toast.success("Link copied");
  };
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-label={item.type} />
      <span className="min-w-0 truncate font-mono text-sm font-bold tracking-widest">{item.code}</span>
      <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{label.replace("Expires in ", "")}</span>
      <Button variant="ghost" size="icon" className="size-8" onClick={copy} aria-label={`Copy link for ${item.code}`}><Link2 /></Button>
      <Button variant="ghost" size="icon" className="size-8" onClick={() => forgetClip(item.code)} aria-label={`Remove ${item.code} from recent`}><X /></Button>
    </li>
  );
}
