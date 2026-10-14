// Shared, browser-safe rules for clips. Used by both the UI and server functions.

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // excludes O, 0, I, L, 1
export const AUTO_CODE_LENGTH = 6;
export const HARD_MAX_TIMER_SECONDS = 86400;
export const MAX_PIN_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
export const MAX_IMAGES_PER_CLIP = 20;
export const MAX_FILES_PER_CLIP = 20;
export const MAX_TOTAL_FILE_BYTES = 100 * 1024 * 1024; // 100 MB total per clip

export const DEFAULT_SETTINGS = {
  default_timer_seconds: 3600,
  allowed_timers: [600, 1800, 3600, 7200, 10800, 21600, 43200, 86400],
  max_text_bytes: 102400,
  max_image_bytes: 10485760,
  max_file_bytes: 26214400,
  blocked_codes: ["admin", "api", "r", "login", "root", "origin", "system"],
  mime_allowlist: [] as string[],
  retention_seconds: 604800,
  maintenance_mode: false,
  announcement_banner: "",
};
export type AppSettings = typeof DEFAULT_SETTINGS;

export function generateCode(random: (n: number) => number = (n) => Math.floor(Math.random() * n)) {
  let out = "";
  for (let i = 0; i < AUTO_CODE_LENGTH; i++) out += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return out;
}

export function normalizeCode(raw: string) {
  return raw.trim().toLowerCase();
}

/** Returns an error message, or null when the custom code is acceptable. */
export function validateCustomCode(raw: string, blocked: string[]): string | null {
  const code = raw.trim();
  if (code.length < 4 || code.length > 20) return "Use 4–20 characters.";
  if (!/^[A-Za-z0-9-]+$/.test(code)) return "Letters, numbers and hyphens only.";
  if (blocked.map((b) => b.toLowerCase()).includes(code.toLowerCase())) return "That code is reserved.";
  return null;
}

export function validatePin(pin: string): string | null {
  if (!/^\d{4,8}$/.test(pin)) return "PIN must be 4–8 digits.";
  return null;
}

export function isAllowedTimer(seconds: number, allowed: number[]) {
  return seconds > 0 && seconds <= HARD_MAX_TIMER_SECONDS && allowed.includes(seconds);
}

export function timerLabel(seconds: number) {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} hr`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatRemaining(ms: number) {
  if (ms <= 0) return "Expired";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `Expires in ${h} hr ${m} min`;
  if (totalMin > 0) return `Expires in ${m} min`;
  return `Expires in ${Math.max(1, Math.floor(ms / 1000))} sec`;
}

export function sanitizeFileName(name: string) {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(-120);
  return cleaned || "file";
}

/** Latest allowed expiry when an admin extends a clip: 24h from creation. */
export function maxExtendedExpiry(createdAt: Date) {
  return new Date(createdAt.getTime() + HARD_MAX_TIMER_SECONDS * 1000);
}

export function mimeAllowed(mime: string, allowlist: string[]) {
  if (!allowlist.length) return true;
  return allowlist.some((rule) =>
    rule.endsWith("/*") ? mime.startsWith(rule.slice(0, -1)) : mime === rule,
  );
}

export type BatchFile = { name: string; mime: string; size: number };

/** Validates a batch of attachments before upload. Returns an error message or null. */
export function validateFileBatch(
  kind: "image" | "file",
  files: BatchFile[],
  settings: Pick<AppSettings, "max_image_bytes" | "max_file_bytes">,
): string | null {
  if (!files.length) return "Add at least one file.";
  const max = kind === "image" ? settings.max_image_bytes : settings.max_file_bytes;
  let total = 0;
  for (const f of files) {
    if (f.size > max) return `Each ${kind === "image" ? "image" : "file"} must be under ${formatBytes(max)}.`;
    total += f.size;
  }
  if (total > MAX_TOTAL_FILE_BYTES) return `Total size must be under ${formatBytes(MAX_TOTAL_FILE_BYTES)}.`;
  if (kind === "image") {
    if (files.length > MAX_IMAGES_PER_CLIP) return `Up to ${MAX_IMAGES_PER_CLIP} images per clip.`;
    if (files.some((f) => !f.mime.startsWith("image/"))) return "Only images can go here.";
  } else if (files.length > MAX_FILES_PER_CLIP) {
    return `Up to ${MAX_FILES_PER_CLIP} files per clip.`;
  }
  return null;
}

/** Heuristic: content looks like markdown (headings, bold, list items, code fences). */
export function looksLikeMarkdown(text: string) {
  return /^#{1,6}\s/m.test(text) || /\*\*[^*\n]+\*\*/.test(text) || /^\s*[-*]\s+\S/m.test(text) || /```/.test(text);
}

/** Read-receipt ping URLs must be public https URLs (no localhost / IP literals). */
export function isSafeNotifyUrl(value: string) {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":") || h.startsWith("[")) return false;
  return h.includes(".");
}

export const HISTORY_LIMIT = 5;
export type HistoryItem = { code: string; type: "text" | "image" | "file"; expiresAt: string; createdAt: string };

/** Newest first, de-duplicated by code, expired items dropped, capped at HISTORY_LIMIT. */
export function addToHistory(list: HistoryItem[], item: HistoryItem, now = Date.now()) {
  return pruneHistory([item, ...list.filter((i) => i.code !== item.code)], now);
}
export function pruneHistory(list: HistoryItem[], now = Date.now()) {
  return list.filter((i) => new Date(i.expiresAt).getTime() > now).slice(0, HISTORY_LIMIT);
}
