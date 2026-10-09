import { useEffect, useState } from "react";
import { formatRemaining } from "@/lib/clip-rules";

export function useCountdown(expiresAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!expiresAt) return { label: "", expired: false };
  const ms = new Date(expiresAt).getTime() - now;
  return { label: formatRemaining(ms), expired: ms <= 0 };
}
